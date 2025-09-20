let cache;

export async function loadCities() {
  if (cache) {
    return cache;
  }

  const response = await fetch('src/data/cities.json');
  if (!response.ok) {
    throw new Error('Impossible de charger les données des villes');
  }

  const data = await response.json();
  cache = data;
  return data;
}

export async function getCityBySlug(slug) {
  const cities = await loadCities();
  return cities.find((city) => city.slug === slug);
}

export function getUniqueCategories(city) {
  const categories = city.experiences.map((item) => item.category);
  return ['Toutes', ...new Set(categories)];
}
