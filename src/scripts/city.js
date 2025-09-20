import { getCityBySlug, getUniqueCategories } from './data.js';

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('city');

  if (!slug) {
    renderNotFound();
    return;
  }

  try {
    const city = await getCityBySlug(slug);
    if (!city) {
      renderNotFound();
      return;
    }

    renderPage(city);
  } catch (error) {
    console.error(error);
    renderNotFound();
  }
});

function renderNotFound() {
  const root = document.querySelector('#city-root');
  if (!root) return;
  root.innerHTML = `<section class="container" style="padding: var(--space-3xl) 0;">
      <h1>Ville introuvable</h1>
      <p>La page demandée n'existe pas ou n'est pas encore disponible.</p>
      <a class="button button--primary" href="index.html">Retourner à l'accueil</a>
    </section>`;
}

function renderPage(city) {
  updateMeta(city);
  renderHero(city);
  renderHighlights(city);
  renderPractical(city);
  renderExperiences(city);
  renderReviews(city);
  renderMap(city);
}

function updateMeta(city) {
  document.title = `${city.name} | Escapedia`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', `Préparez votre voyage à ${city.name} grâce aux expériences sélectionnées par Escapedia.`);
  }
}

function renderHero(city) {
  const heroName = document.querySelector('[data-city-name]');
  const heroSummary = document.querySelector('[data-city-summary]');
  const heroImage = document.querySelector('[data-city-image]');
  const heroMeta = document.querySelector('[data-city-meta]');

  if (heroName) {
    heroName.textContent = city.name;
  }
  if (heroSummary) {
    heroSummary.textContent = city.summary;
  }
  if (heroImage) {
    heroImage.src = city.heroImage;
    heroImage.alt = `Illustration de ${city.name}`;
  }
  if (heroMeta) {
    heroMeta.innerHTML = '';
    city.highlights.slice(0, 3).forEach((highlight) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `${highlight.icon} ${highlight.title}`;
      heroMeta.appendChild(span);
    });
  }

  const breadcrumbCurrent = document.querySelector('[data-breadcrumb-current]');
  if (breadcrumbCurrent) {
    breadcrumbCurrent.textContent = city.name;
  }

  const factsList = document.querySelector('[data-quick-facts]');
  if (factsList) {
    factsList.innerHTML = '';
    city.quickFacts.forEach((fact) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'text-muted';
      label.textContent = fact.label;
      const value = document.createElement('strong');
      value.textContent = fact.value;
      li.append(label, value);
      factsList.appendChild(li);
    });
  }
}

function renderHighlights(city) {
  const highlightsList = document.querySelector('[data-highlights]');
  if (!highlightsList) return;

  highlightsList.innerHTML = '';
  city.highlights.forEach((highlight) => {
    const li = document.createElement('li');
    const title = document.createElement('h3');
    title.textContent = `${highlight.icon} ${highlight.title}`;
    title.style.margin = '0';
    const description = document.createElement('p');
    description.textContent = highlight.description;
    description.className = 'text-muted';
    li.append(title, description);
    highlightsList.appendChild(li);
  });
}

function renderPractical(city) {
  const practicalGrid = document.querySelector('[data-practical]');
  if (!practicalGrid) return;
  practicalGrid.innerHTML = '';

  city.practical.forEach((category) => {
    const card = document.createElement('article');
    card.className = 'practical-card';
    const title = document.createElement('h3');
    title.textContent = category.title;
    const list = document.createElement('ul');
    list.style.padding = '0';
    list.style.margin = '0';
    list.style.display = 'grid';
    list.style.gap = 'var(--space-sm)';
    list.style.listStyle = 'none';
    category.items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    card.append(title, list);
    practicalGrid.appendChild(card);
  });
}

function renderExperiences(city) {
  const filterGroup = document.querySelector('[data-experience-filters]');
  const grid = document.querySelector('[data-experiences]');
  if (!grid || !filterGroup) return;

  const categories = getUniqueCategories(city);
  let activeCategory = categories[0];

  function updateActive(category) {
    activeCategory = category;
    Array.from(filterGroup.children).forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === category));
    });
    renderCards();
  }

  function renderCards() {
    grid.innerHTML = '';
    const filtered =
      activeCategory === 'Toutes'
        ? city.experiences
        : city.experiences.filter((experience) => experience.category === activeCategory);

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = "Aucune expérience ne correspond à ce filtre pour le moment.";
      empty.className = 'text-muted';
      grid.appendChild(empty);
      return;
    }

    filtered.forEach((experience) => {
      const card = document.createElement('article');
      card.className = 'experience-card';

      const image = document.createElement('img');
      image.src = experience.image;
      image.alt = experience.title;
      image.loading = 'lazy';

      const title = document.createElement('h3');
      title.textContent = experience.title;

      const meta = document.createElement('div');
      meta.className = 'experience-card__meta';
      const category = document.createElement('span');
      category.innerHTML = `Catégorie : <strong>${experience.category}</strong>`;
      const duration = document.createElement('span');
      duration.innerHTML = `Durée : <strong>${experience.duration}</strong>`;
      meta.append(category, duration);

      const description = document.createElement('p');
      description.textContent = experience.description;
      description.className = 'text-muted';

      const cta = document.createElement('a');
      cta.href = `mailto:contact@escapedia.com?subject=${encodeURIComponent(
        'Intérêt pour ' + experience.title
      )}`;
      cta.className = 'button button--ghost';
      cta.textContent = 'En savoir plus';
      cta.setAttribute('aria-label', `En savoir plus sur ${experience.title}`);

      card.append(image, title, meta, description, cta);
      grid.appendChild(card);
    });
  }

  filterGroup.innerHTML = '';
  categories.forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-chip';
    button.dataset.filter = category;
    button.textContent = category;
    button.setAttribute('aria-pressed', String(category === activeCategory));
    button.addEventListener('click', () => updateActive(category));
    filterGroup.appendChild(button);
  });

  renderCards();
}

function renderReviews(city) {
  const grid = document.querySelector('[data-reviews]');
  if (!grid) return;

  grid.innerHTML = '';
  city.reviews.forEach((review) => {
    const card = document.createElement('article');
    card.className = 'review-card';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'baseline';

    const title = document.createElement('h3');
    title.textContent = review.title;

    const rating = document.createElement('span');
    rating.className = 'review-card__rating';
    rating.textContent = '★'.repeat(review.rating);

    header.append(title, rating);

    const content = document.createElement('p');
    content.textContent = review.content;
    content.className = 'text-muted';

    const footer = document.createElement('p');
    footer.className = 'text-muted';
    footer.textContent = `— ${review.author}`;

    card.append(header, content, footer);
    grid.appendChild(card);
  });
}

function renderMap(city) {
  const map = document.querySelector('[data-city-map]');
  if (!map) return;

  const { lat, lng } = city.coordinates;
  const bbox = `${lng - 0.05},${lat - 0.05},${lng + 0.05},${lat + 0.05}`;
  map.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  map.title = `Carte de ${city.name}`;
}
