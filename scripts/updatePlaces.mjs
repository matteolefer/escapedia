#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CITIES_PATH = path.resolve(ROOT_DIR, 'src', 'data', 'cities.json');

const fetchApi = globalThis.fetch;
const USER_AGENT = 'escapedia-updatePlaces/1.0 (+https://openstreetmap.org)';

if (typeof fetchApi !== 'function') {
  console.error('[updatePlaces] Cette version de Node.js ne fournit pas l\'API fetch. Utilisez Node 18+ ou installez node-fetch.');
  process.exit(1);
}

const [, , rawCity, rawCountry] = process.argv;

if (!rawCity) {
  console.error('Usage : node scripts/updatePlaces.mjs <ville> [pays]');
  process.exit(1);
}

try {
  await updateCityPlaces(rawCity, rawCountry);
} catch (error) {
  console.error(`[updatePlaces] Échec de la synchronisation : ${error.message}`);
  process.exitCode = 1;
}

async function updateCityPlaces(cityArg, countryArg) {
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

  const locationLabel = buildLocationLabel(cityArg, countryArg);
  console.log(`[updatePlaces] Résolution de la zone Overpass via Nominatim pour ${locationLabel}.`);
  console.log(
    `[updatePlaces] Recherche de nouvelles expériences pour ${targetCity.name} via Overpass (${locationLabel}).`
  );

  const query = await buildOverpassQuery(cityArg, countryArg);
  const overpassElements = await requestOverpassData(query);

  if (!overpassElements.length) {
    console.log('[updatePlaces] Aucun résultat retourné par Overpass.');
    return;
  }

  const summary = mergeExperiences(targetCity, overpassElements);

  targetCity.experiences.sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));

  await fs.writeFile(CITIES_PATH, `${JSON.stringify(cities, null, 2)}\n`, 'utf8');

  console.log(
    `[updatePlaces] Synchronisation terminée : ${summary.added} ajout(s), ${summary.updated} mise(s) à jour pour ${targetCity.name}.`
  );
  if (summary.titles.length) {
    console.log(`[updatePlaces] Expériences traitées : ${summary.titles.join(', ')}.`);
  }
}

async function requestOverpassData(query) {
  let response;
  try {
    response = await fetchApi('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        'User-Agent': USER_AGENT
      },
      body: `data=${encodeURIComponent(query)}`
    });
  } catch (error) {
    throw new Error(`Requête Overpass indisponible : ${error.message}`, { cause: error });
  }

  if (!response.ok) {
    let detail = '';
    try {
      const text = await response.text();
      if (text && text.trim().length) {
        detail = ` : ${text.trim()}`;
      }
    } catch (error) {
      // Ignore body parsing errors and keep the HTTP status message only.
    }
    throw new Error(`Requête Overpass échouée (${response.status} ${response.statusText})${detail}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.elements)) {
    return [];
  }

  return payload.elements;
}

function mergeExperiences(targetCity, overpassElements) {
  const summary = { added: 0, updated: 0, titles: [] };
  for (const element of overpassElements) {
    const tags = element.tags ?? {};
    const name = tags.name?.trim();
    if (!name) {
      continue;
    }

    const identifier = buildPlaceIdentifier(element);
    const osmUrl = buildOpenStreetMapUrl(element);
    const slug = slugify(name);

    const index = targetCity.experiences.findIndex((experience) => {
      return (
        experience.placeId === identifier ||
        experience.id === slug ||
        experience.source?.url === osmUrl
      );
    });

    const previous = index >= 0 ? targetCity.experiences[index] : undefined;
    const next = buildExperience(element, previous, targetCity);

    if (!next) {
      continue;
    }

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

function buildExperience(element, previous = {}, city) {
  const tags = element.tags ?? {};
  const name = tags.name ?? previous.title;
  if (!name) {
    return null;
  }

  const identifier = buildPlaceIdentifier(element);
  const osmUrl = buildOpenStreetMapUrl(element);
  const { labels: typeLabels, values: typeValues } = extractTypes(tags);
  const coordinates = buildCoordinates(element);
  const address = buildAddress(tags);
  const website = tags.website ?? tags['contact:website'] ?? tags.url ?? previous.website ?? null;
  const description = tags.description ?? tags.note ?? previous.description ?? null;
  const retrievedAt = new Date().toISOString().slice(0, 7);
  const image = previous.imageUrl ?? previous.image ?? city.heroImage ?? null;
  const previousTypes = Array.isArray(previous.types) ? previous.types : [];
  const types = typeLabels.length ? typeLabels : previousTypes;

  const sourceUrl = osmUrl ?? previous.source?.url ?? null;

  const experience = {
    id: previous.id ?? slugify(name),
    title: name,
    category: previous.category ?? inferCategory(typeValues),
    duration: previous.duration ?? null,
    description,
    image,
    imageUrl: image,
    placeId: identifier,
    address: address ?? previous.address ?? null,
    latitude: coordinates.lat ?? previous.latitude ?? null,
    longitude: coordinates.lon ?? previous.longitude ?? null,
    rating: previous.rating ?? null,
    ratingsTotal: previous.ratingsTotal ?? null,
    status: previous.status ?? null,
    website,
    types,
    source: {
      name: 'OpenStreetMap (Overpass)',
      url: sourceUrl,
      retrievedAt
    }
  };

  if (previous.source) {
    experience.source = {
      ...previous.source,
      ...experience.source,
      retrievedAt: experience.source.retrievedAt ?? previous.source.retrievedAt ?? retrievedAt
    };
  }

  return experience;
}

function buildLocationLabel(city, country) {
  const trimmedCity = city.trim();
  const trimmedCountry = country ? country.trim() : '';
  return trimmedCountry ? `${trimmedCity}, ${trimmedCountry}` : trimmedCity;
}

async function buildOverpassQuery(city, country) {
  const location = buildLocationLabel(city, country);
  const categories = ['tourism', 'amenity', 'leisure', 'historic', 'shop', 'sport', 'natural'];
  const selectors = categories
    .map((category) => [`  node["${category}"](area.searchArea);`, `  way["${category}"](area.searchArea);`, `  relation["${category}"](area.searchArea);`])
    .flat();

  const sanitizedLocation = location.replace(/[\n\r]+/g, ' ').trim();
  const areaId = await resolveOverpassAreaId(city, country);

  if (!areaId) {
    throw new Error(
      `Impossible de déterminer une zone Overpass pour ${sanitizedLocation}. Vérifiez l'orthographe ou précisez le pays.`
    );
  }

  return [
    '[out:json][timeout:25];',
    `area(${areaId})->.searchArea;`,
    '(',
    selectors.join('\n'),
    ');',
    'out center 40;'
  ].join('\n');
}

async function resolveOverpassAreaId(city, country) {
  const location = buildLocationLabel(city, country);
  const params = new URLSearchParams({
    q: location,
    format: 'jsonv2',
    addressdetails: '0',
    extratags: '0',
    polygon_geojson: '0',
    limit: '1'
  });

  let response;
  try {
    response = await fetchApi(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT
      }
    });
  } catch (error) {
    throw new Error(`Résolution de la zone via Nominatim indisponible : ${error.message}`, { cause: error });
  }

  if (!response.ok) {
    let detail = '';
    try {
      const text = await response.text();
      if (text && text.trim().length) {
        detail = ` : ${text.trim()}`;
      }
    } catch (error) {
      // Ignore body parsing errors and keep the HTTP status message only.
    }
    throw new Error(`Résolution de la zone via Nominatim échouée (${response.status} ${response.statusText})${detail}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const place = payload[0];
  const osmType = typeof place.osm_type === 'string' ? place.osm_type.toLowerCase() : '';
  const osmId = Number.parseInt(place.osm_id, 10);

  if (!osmType || !Number.isFinite(osmId)) {
    return null;
  }

  return toOverpassAreaId(osmType, osmId);
}

function toOverpassAreaId(osmType, osmId) {
  if (!osmType || !Number.isFinite(osmId)) {
    return null;
  }

  if (osmType === 'relation') {
    return 3600000000 + osmId;
  }

  if (osmType === 'way') {
    return 2400000000 + osmId;
  }

  return null;
}

function extractTypes(tags = {}) {
  const interestingKeys = ['tourism', 'amenity', 'leisure', 'historic', 'shop', 'sport', 'natural', 'craft'];
  const labels = new Set();
  const values = new Set();

  for (const key of interestingKeys) {
    const raw = tags[key];
    if (!raw || typeof raw !== 'string') {
      continue;
    }
    const parts = raw
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      labels.add(`${key}:${part}`);
      values.add(part.toLowerCase());
    }
  }

  return {
    labels: Array.from(labels),
    values: Array.from(values)
  };
}

function inferCategory(types = []) {
  const normalizedTypes = types.map((type) => type.toLowerCase());
  const priorities = [
    {
      types: [
        'museum',
        'art_gallery',
        'theatre',
        'cinema',
        'arts_centre',
        'attraction',
        'viewpoint',
        'heritage',
        'monument',
        'castle',
        'ruins',
        'zoo',
        'theme_park',
        'aquarium'
      ],
      category: 'Culture'
    },
    {
      types: ['restaurant', 'cafe', 'bakery', 'bar', 'pub', 'food_court', 'fast_food', 'ice_cream', 'winery', 'brewery'],
      category: 'Gastronomie'
    },
    {
      types: [
        'park',
        'garden',
        'nature_reserve',
        'protected_area',
        'beach',
        'forest',
        'wood',
        'meadow',
        'water',
        'waterfall',
        'peak',
        'camp_site',
        'picnic_site',
        'trailhead',
        'swimming_area'
      ],
      category: 'Nature'
    },
    {
      types: ['spa', 'sauna', 'gym', 'fitness_centre', 'wellness', 'swimming_pool', 'thermal_bath'],
      category: 'Bien-être'
    }
  ];

  for (const { types: candidates, category } of priorities) {
    if (normalizedTypes.some((type) => candidates.includes(type))) {
      return category;
    }
  }

  return 'Découverte';
}

function buildAddress(tags = {}) {
  if (typeof tags['addr:full'] === 'string' && tags['addr:full'].trim()) {
    return tags['addr:full'].trim();
  }

  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim();
  const cityLine = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ').trim();
  const country = typeof tags['addr:country'] === 'string' ? tags['addr:country'].trim() : '';

  const segments = [street, cityLine, country].filter((segment) => segment && segment.length);
  return segments.length ? segments.join(', ') : null;
}

function buildCoordinates(element = {}) {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lon: element.lon };
  }

  if (element.center && typeof element.center.lat === 'number' && typeof element.center.lon === 'number') {
    return { lat: element.center.lat, lon: element.center.lon };
  }

  return { lat: null, lon: null };
}

function buildOpenStreetMapUrl(element = {}) {
  if (!element.type || typeof element.id === 'undefined') {
    return null;
  }
  return `https://www.openstreetmap.org/${element.type}/${element.id}`;
}

function buildPlaceIdentifier(element = {}) {
  if (!element.type || typeof element.id === 'undefined') {
    return null;
  }
  return `osm:${element.type}/${element.id}`;
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
