import { loadCities } from './data.js';
import { createCityCard } from './components/cityCard.js';

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.querySelector('[data-city-grid]');
  const status = document.querySelector('[data-fetch-status]');

  try {
    const cities = await loadCities();
    if (status) {
      status.remove();
    }

    const fragment = document.createDocumentFragment();
    cities.forEach((city) => {
      fragment.appendChild(createCityCard(city));
    });

    if (grid) {
      grid.appendChild(fragment);
    }
  } catch (error) {
    if (status) {
      status.textContent = "Oups ! Impossible de charger les villes pour le moment.";
      status.classList.add('text-muted');
    }
    console.error(error);
  }
});
