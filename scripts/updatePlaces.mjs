#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import typeMapModule from './placeTypeMap.js';

const { mapPlaceTypesToCategory, FALLBACK_CATEGORY } = typeMapModule;

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const TEXT_SEARCH_DELAY_MS = parseNumber(process.env.GOOGLE_TEXT_DELAY_MS, 1000);
const DETAILS_DELAY_MS = parseNumber(process.env.GOOGLE_DETAILS_DELAY_MS, 1000);
const PHOTO_DELAY_MS = parseNumber(process.env.GOOGLE_PHOTO_DELAY_MS, 1500);
const NEXT_PAGE_DELAY_MS = 2000;
const rawMaxPagesEnv = process.env.GOOGLE_MAX_PAGES;
const MAX_TEXT_SEARCH_PAGES =
  rawMaxPagesEnv && ['0', 'all', 'inf', 'infinite', 'infinity', 'unlimited'].includes(rawMaxPagesEnv.trim().toLowerCase())
    ? Infinity
    : parsePositiveInt(rawMaxPagesEnv, 3);
const LANGUAGE = (process.env.GOOGLE_LANGUAGE ?? 'fr').trim() || 'fr';

const SEARCH_QUERIES = ['museums', 'monuments', 'restaurants', 'parks'];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, '../src/data/cities.json');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalisePlace(details, imageUrl) {
  const { place_id: placeId, name, types = [], formatted_address: address = '' } = details;
  const category = mapPlaceTypesToCategory(types);
  const location = details.geometry?.location ?? {};

  return {
    title: name,
    category,
    address,
    latitude: typeof location.lat === 'number' ? location.lat : null,
    longitude: typeof location.lng === 'number' ? location.lng : null,
    rating: typeof details.rating === 'number' ? details.rating : null,
    ratingsTotal: typeof details.user_ratings_total === 'number' ? details.user_ratings_total : null,
    status: details.business_status ?? null,
    imageUrl: imageUrl ?? null,
    placeId
  };
}

function mergeActivity(existing, incoming) {
  const merged = { ...existing };
  let changed = false;
  const fields = [
    'title',
    'category',
    'address',
    'latitude',
    'longitude',
    'rating',
    'ratingsTotal',
    'status',
    'imageUrl'
  ];

  for (const field of fields) {
    const newValue = incoming[field];
    if (newValue === undefined || newValue === null || newValue === '') {
      continue;
    }

    if (merged[field] !== newValue) {
      merged[field] = newValue;
      changed = true;
    }
  }

  if (!merged.placeId) {
    merged.placeId = incoming.placeId;
    changed = true;
  }

  return { merged, changed };
}

function sortActivities(activities) {
  return [...activities].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
}

function sortCities(cities) {
  return [...cities].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

async function fetchJsonWithRetry(url, description, delayMs) {
  await delay(delayMs);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${description} – HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchTextSearchResults(query, apiKey) {
  const results = [];
  let pageToken = null;
  let pageIndex = 0;

  while (true) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', LANGUAGE);
    if (pageToken) {
      url.searchParams.set('pagetoken', pageToken);
    } else {
      url.searchParams.set('query', query);
    }

    const payload = await fetchJsonWithRetry(url.toString(), `Text search for ${query}`, TEXT_SEARCH_DELAY_MS);

    if (payload.status === 'OVER_QUERY_LIMIT') {
      console.warn(`Quota reached while fetching "${query}". Waiting ${NEXT_PAGE_DELAY_MS}ms before retrying...`);
      await delay(NEXT_PAGE_DELAY_MS);
      continue;
    }

    if (payload.status === 'INVALID_REQUEST' && pageToken) {
      console.warn(`Next page token not ready for "${query}" yet. Retrying in ${NEXT_PAGE_DELAY_MS}ms...`);
      await delay(NEXT_PAGE_DELAY_MS);
      continue;
    }

    if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
      console.warn(`Google Places Text Search returned status "${payload.status}" for query "${query}".`);
      break;
    }

    if (Array.isArray(payload.results)) {
      results.push(...payload.results);
    }

    if (payload.status === 'ZERO_RESULTS') {
      break;
    }

    pageIndex += 1;

    const nextPageToken = payload.next_page_token;
    const hasReachedLimit = Number.isFinite(MAX_TEXT_SEARCH_PAGES) && pageIndex >= MAX_TEXT_SEARCH_PAGES;

    if (!nextPageToken || hasReachedLimit) {
      break;
    }

    pageToken = nextPageToken;
    await delay(NEXT_PAGE_DELAY_MS);
  }

  return results;
}

async function fetchPlaceDetails(placeId, apiKey) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set(
    'fields',
    'place_id,name,types,formatted_address,geometry/location,rating,user_ratings_total,business_status,photos'
  );
  url.searchParams.set('language', LANGUAGE);

  const payload = await fetchJsonWithRetry(url.toString(), `Details for ${placeId}`, DETAILS_DELAY_MS);
  if (payload.status !== 'OK') {
    console.warn(`Place Details returned status "${payload.status}" for place ${placeId}.`);
    return null;
  }

  return payload.result;
}

async function resolvePhotoUrl(photoReference, apiKey) {
  if (!photoReference) {
    return null;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/photo');
  url.searchParams.set('photo_reference', photoReference);
  url.searchParams.set('maxwidth', '1600');
  url.searchParams.set('key', apiKey);

  await delay(PHOTO_DELAY_MS);
  const response = await fetch(url, { redirect: 'manual' });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) {
      return location;
    }
  }

  if (response.ok) {
    return response.url;
  }

  console.warn(`Unable to resolve photo URL for reference ${photoReference}. Received status ${response.status}.`);
  return null;
}

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('Missing GOOGLE_API_KEY environment variable.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/updatePlaces.mjs <city> [country]');
    process.exit(1);
  }

  const [cityArg, ...rest] = args;
  const countryArg = rest.join(' ').trim();
  const locationQuery = countryArg ? `${cityArg}, ${countryArg}` : cityArg;

  const citySlug = slugify(cityArg);

  let rawJson;
  try {
    rawJson = await fs.readFile(DATA_PATH, 'utf8');
  } catch (error) {
    console.error(`Unable to read ${DATA_PATH}:`, error.message);
    process.exit(1);
  }

  let cities;
  try {
    cities = JSON.parse(rawJson);
  } catch (error) {
    console.error('Unable to parse cities.json:', error.message);
    process.exit(1);
  }

  const targetCity = cities.find((city) => {
    if (city.slug) {
      return slugify(city.slug) === citySlug;
    }
    return slugify(city.name) === citySlug;
  });

  if (!targetCity) {
    console.error(`City with slug "${citySlug}" not found in cities.json.`);
    process.exit(1);
  }

  console.info(`Fetching Google Places data for ${locationQuery}...`);

  const aggregated = new Map();
  for (const search of SEARCH_QUERIES) {
    const query = `${search} in ${locationQuery}`;
    try {
      const results = await fetchTextSearchResults(query, apiKey);
      for (const result of results) {
        if (result.place_id && !aggregated.has(result.place_id)) {
          aggregated.set(result.place_id, result);
        }
      }
      console.info(`→ ${results.length} results for "${query}"`);
    } catch (error) {
      console.error(`Failed to fetch results for "${query}": ${error.message}`);
    }
  }

  if (aggregated.size === 0) {
    console.warn('No places found. Aborting without modifying the data file.');
    return;
  }

  const additions = [];
  const updates = [];
  const detailsList = [];

  for (const placeId of aggregated.keys()) {
    try {
      const details = await fetchPlaceDetails(placeId, apiKey);
      if (!details) {
        continue;
      }

      let imageUrl = null;
      if (Array.isArray(details.photos) && details.photos.length > 0) {
        imageUrl = await resolvePhotoUrl(details.photos[0].photo_reference, apiKey);
      }

      detailsList.push({ details, imageUrl });
    } catch (error) {
      console.error(`Failed to fetch details for place ${placeId}: ${error.message}`);
    }
  }

  const normalisedPlaces = [];
  for (const { details, imageUrl } of detailsList) {
    try {
      const place = normalisePlace(details, imageUrl);
      normalisedPlaces.push(place);
    } catch (error) {
      console.error(`Failed to normalise place ${details?.place_id ?? 'unknown'}: ${error.message}`);
    }
  }

  if (!targetCity.activities) {
    targetCity.activities = [];
  }

  for (const place of normalisedPlaces) {
    const existingIndex = targetCity.activities.findIndex((item) => item.placeId === place.placeId);
    if (existingIndex === -1) {
      targetCity.activities.push(place);
      additions.push(place);
      console.info(`+ Added ${place.title} [${place.category ?? FALLBACK_CATEGORY}]`);
    } else {
      const existing = targetCity.activities[existingIndex];
      const { merged, changed } = mergeActivity(existing, place);
      if (changed) {
        targetCity.activities[existingIndex] = merged;
        updates.push(merged);
        console.info(`~ Updated ${merged.title}`);
      }
    }
  }

  targetCity.activities = sortActivities(targetCity.activities);

  const sortedCities = sortCities(cities);
  const output = `${JSON.stringify(sortedCities, null, 2)}\n`;
  await fs.writeFile(DATA_PATH, output, 'utf8');

  console.info(
    `Completed update for ${targetCity.name}. Added ${additions.length} place(s), updated ${updates.length} existing entries.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
