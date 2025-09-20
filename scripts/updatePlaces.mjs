#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CITIES_PATH = path.resolve(ROOT_DIR, 'src', 'data', 'cities.json');

const fetchApi = globalThis.fetch;

if (typeof fetchApi !== 'function') {
  console.error('[updatePlaces] Cette version de Node.js ne fournit pas l\'API fetch. Utilisez Node 18+ ou installez node-fetch.');
  process.exit(1);
}

const [, , rawCity, rawCountry] = process.argv;

if (!rawCity) {
  console.error('Usage : node scripts/updatePlaces.mjs <ville> [pays]');
  process.exit(1);
}

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error('[updatePlaces] La variable d\'environnement GOOGLE_API_KEY est requise.');
  process.exit(1);
}

try {
  await updateCityPlaces(rawCity, rawCountry, apiKey);
} catch (error) {
  console.error(`[updatePlaces] Échec de la synchronisation : ${error.message}`);
  process.exitCode = 1;
}

async function updateCityPlaces(cityArg, countryArg, key) {
  const dataBuffer = await fs.readFile(CITIES_PATH, 'utf8');
  const cities = JSON.parse(dataBuffer);

  const citySlug = slugify(cityArg);
  const countrySlug = countryArg ? slugify(countryArg) : null;

  const targetCity = cities.find((city) => {
    const candidateSlug = slugify(city.slug ?? city.name);
    const candidateCountry = slugify(city.country ?? '');
    if (candidateSlug !== citySlug && slugify(city.name) !== citySlug) {
      return false;
    }
    if (!countrySlug) {
      return true;
    }
    return candidateCountry === countrySlug;
  });

  if (!targetCity) {
    throw new Error(`Impossible de trouver la ville « ${cityArg} » dans src/data/cities.json.`);
  }

  targetCity.experiences ??= [];

  const query = buildSearchQuery(cityArg, countryArg);
  console.log(`[updatePlaces] Recherche de nouvelles expériences pour ${targetCity.name} (${query}).`);

  const searchResults = await searchPlaces(query, key);
  if (!searchResults.length) {
    console.log('[updatePlaces] Aucun résultat retourné par Google Places.');
    return;
  }

  const details = await fetchPlaceDetails(searchResults, key);
  const summary = mergeExperiences(targetCity, details, key);

  targetCity.experiences.sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));

  await fs.writeFile(CITIES_PATH, `${JSON.stringify(cities, null, 2)}\n`, 'utf8');

  console.log(
    `[updatePlaces] Synchronisation terminée : ${summary.added} ajout(s), ${summary.updated} mise(s) à jour pour ${targetCity.name}.`
  );
  if (summary.titles.length) {
    console.log(`[updatePlaces] Expériences traitées : ${summary.titles.join(', ')}.`);
  }
}

async function searchPlaces(query, key) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.search = new URLSearchParams({
    query,
    key,
    language: 'fr'
  }).toString();

  const response = await fetchApi(url);
  if (!response.ok) {
    throw new Error(`Requête textsearch échouée (${response.status} ${response.statusText}).`);
  }

  const payload = await response.json();
  if (payload.error_message) {
    throw new Error(payload.error_message);
  }

  if (!Array.isArray(payload.results)) {
    return [];
  }

  return payload.results;
}

async function fetchPlaceDetails(places, key) {
  const details = [];
  for (const place of places) {
    try {
      const data = await getPlaceDetail(place.place_id, key);
      details.push(data);
    } catch (error) {
      console.error(`[updatePlaces] Échec lors de la récupération du lieu ${place.name} : ${error.message}`);
    }
  }
  return details;
}

async function getPlaceDetail(placeId, key) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.search = new URLSearchParams({
    place_id: placeId,
    key,
    language: 'fr',
    fields:
      'place_id,name,formatted_address,geometry/location,rating,user_ratings_total,editorial_summary,business_status,photos,types,website'
  }).toString();

  const response = await fetchApi(url);
  if (!response.ok) {
    throw new Error(`Requête details échouée (${response.status} ${response.statusText}).`);
  }

  const payload = await response.json();
  if (payload.error_message) {
    throw new Error(payload.error_message);
  }

  if (payload.status !== 'OK' || !payload.result) {
    throw new Error(`Statut inattendu retourné par l'API : ${payload.status ?? 'inconnu'}.`);
  }

  return payload.result;
}

function mergeExperiences(targetCity, placeDetails, apiKey) {
  const summary = { added: 0, updated: 0, titles: [] };
  for (const detail of placeDetails) {
    const identifier = detail.place_id;
    const index = targetCity.experiences.findIndex(
      (experience) => experience.placeId === identifier || experience.id === slugify(detail.name)
    );

    const previous = index >= 0 ? targetCity.experiences[index] : undefined;
    const next = buildExperience(detail, previous, targetCity, apiKey);

    if (index >= 0) {
      targetCity.experiences[index] = next;
      summary.updated += 1;
    } else {
      targetCity.experiences.push(next);
      summary.added += 1;
    }

    summary.titles.push(next.title);
  }
  return summary;
}

function buildExperience(detail, previous = {}, city, apiKey) {
  const photoReference = detail.photos?.[0]?.photo_reference;
  const photoUrl = photoReference ? buildPhotoUrl(photoReference, apiKey) : previous.imageUrl ?? previous.image ?? city.heroImage;
  const retrievedAt = new Date().toISOString().slice(0, 7);

  const experience = {
    id: previous.id ?? slugify(detail.name),
    title: detail.name,
    category: previous.category ?? inferCategory(detail.types),
    duration: previous.duration ?? null,
    description: detail.editorial_summary?.overview ?? previous.description ?? null,
    image: photoUrl,
    imageUrl: photoUrl,
    placeId: detail.place_id,
    address: detail.formatted_address ?? previous.address ?? null,
    latitude: detail.geometry?.location?.lat ?? previous.latitude ?? null,
    longitude: detail.geometry?.location?.lng ?? previous.longitude ?? null,
    rating: detail.rating ?? previous.rating ?? null,
    ratingsTotal: detail.user_ratings_total ?? previous.ratingsTotal ?? null,
    status: formatStatus(detail.business_status) ?? previous.status ?? null,
    website: detail.website ?? previous.website,
    source: {
      name: 'Google Maps',
      url: `https://www.google.com/maps/place/?q=place_id:${detail.place_id}`,
      retrievedAt
    }
  };

  if (previous.source) {
    experience.source = {
      ...experience.source,
      name: previous.source.name ?? experience.source.name,
      url: previous.source.url ?? experience.source.url,
      retrievedAt: experience.source.retrievedAt ?? previous.source.retrievedAt ?? retrievedAt
    };
  }

  return experience;
}

function buildPhotoUrl(reference, key) {
  const params = new URLSearchParams({
    maxwidth: '1600',
    photoreference: reference,
    key
  });
  return `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;
}

function buildSearchQuery(city, country) {
  const trimmedCity = city.trim();
  const trimmedCountry = country ? country.trim() : '';
  const location = trimmedCountry ? `${trimmedCity}, ${trimmedCountry}` : trimmedCity;
  return `${location} points of interest`;
}

function inferCategory(types = []) {
  const normalizedTypes = types.map((type) => type.toLowerCase());
  const priorities = [
    { types: ['museum', 'art_gallery', 'tourist_attraction'], category: 'Culture' },
    { types: ['restaurant', 'cafe', 'bakery', 'bar'], category: 'Gastronomie' },
    { types: ['park', 'natural_feature', 'campground'], category: 'Nature' },
    { types: ['spa', 'gym', 'lodging'], category: 'Bien-être' }
  ];

  for (const { types: candidates, category } of priorities) {
    if (normalizedTypes.some((type) => candidates.includes(type))) {
      return category;
    }
  }

  return 'Découverte';
}

function formatStatus(status) {
  switch (status) {
    case 'OPERATIONAL':
      return 'Ouvert actuellement';
    case 'CLOSED_TEMPORARILY':
      return 'Fermeture temporaire';
    case 'CLOSED_PERMANENTLY':
      return 'Fermeture permanente';
    default:
      return status ?? null;
  }
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
