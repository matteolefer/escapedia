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

  const numberFormatter = new Intl.NumberFormat('fr-FR');

  function createMetaItem(label, value, fallback) {
    const span = document.createElement('span');
    span.className = 'experience-card__meta-item';

    const labelNode = document.createElement('span');
    labelNode.className = 'experience-card__meta-label';
    labelNode.textContent = label;

    const valueNode = document.createElement('strong');
    valueNode.className = 'experience-card__meta-value';

    if (value == null || value === '') {
      span.classList.add('experience-card__meta-item--placeholder');
      valueNode.classList.add('experience-card__meta-value--placeholder');
      valueNode.textContent = fallback;
    } else {
      valueNode.textContent = value;
    }

    span.append(labelNode, valueNode);
    return span;
  }

  function addDetail(container, label, value, isPlaceholder = false) {
    const dt = document.createElement('dt');
    dt.textContent = label;

    const dd = document.createElement('dd');
    if (value instanceof Node) {
      dd.appendChild(value);
    } else {
      dd.textContent = value;
    }

    if (isPlaceholder) {
      dd.classList.add('experience-card__details-value--placeholder');
    }

    container.append(dt, dd);
  }

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

      if (experience.placeId) {
        card.dataset.placeId = experience.placeId;
      }

      const elements = [];

      const imageSource = experience.imageUrl || experience.image;
      if (imageSource) {
        const image = document.createElement('img');
        image.src = imageSource;
        image.alt = experience.title;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.className = 'experience-card__image';
        elements.push(image);
      }

      const header = document.createElement('div');
      header.className = 'experience-card__header';

      const title = document.createElement('h3');
      title.textContent = experience.title;

      const statusBadge = document.createElement('span');
      statusBadge.className = 'experience-card__status';
      const statusText = experience.status || 'Statut à confirmer';
      statusBadge.textContent = statusText;

      const normalizedStatus = statusText.toLowerCase();
      if (normalizedStatus.includes('ouvert') || normalizedStatus.includes('disponible')) {
        statusBadge.classList.add('experience-card__status--success');
      } else if (
        normalizedStatus.includes('ferm') ||
        normalizedStatus.includes('complet') ||
        normalizedStatus.includes('indisponible')
      ) {
        statusBadge.classList.add('experience-card__status--warning');
      }

      header.append(title, statusBadge);
      elements.push(header);

      const meta = document.createElement('div');
      meta.className = 'experience-card__meta';
      const category = createMetaItem('Catégorie', experience.category, 'Non définie');
      const duration = createMetaItem('Durée', experience.duration, 'À préciser');
      meta.append(category, duration);
      elements.push(meta);

      const description = document.createElement('p');
      description.textContent = experience.description;
      description.className = 'text-muted';

      elements.push(description);

      const details = document.createElement('dl');
      details.className = 'experience-card__details';

      const hasAddress = Boolean(experience.address);
      addDetail(details, 'Adresse', hasAddress ? experience.address : 'Non communiquée', !hasAddress);

      if (typeof experience.rating === 'number') {
        let ratingText = `${experience.rating.toFixed(1)} / 5`;
        if (typeof experience.ratingsTotal === 'number' && experience.ratingsTotal > 0) {
          ratingText += ` · ${numberFormatter.format(experience.ratingsTotal)} avis`;
        }
        addDetail(details, 'Note', ratingText);
      } else {
        addDetail(details, 'Note', 'Non disponible', true);
      }

      const hasCoordinates =
        typeof experience.latitude === 'number' && typeof experience.longitude === 'number';

      if (hasCoordinates) {
        const mapLink = document.createElement('a');
        mapLink.href = `https://www.google.com/maps/search/?api=1&query=${experience.latitude},${experience.longitude}`;
        mapLink.target = '_blank';
        mapLink.rel = 'noopener';
        mapLink.className = 'experience-card__map-link';
        mapLink.textContent = 'Voir sur la carte';
        mapLink.setAttribute('aria-label', `Voir ${experience.title} sur la carte`);
        addDetail(details, 'Localisation', mapLink);
      } else {
        addDetail(details, 'Localisation', 'Lien non disponible', true);
      }

      elements.push(details);

      const cta = document.createElement('a');
      cta.href = `mailto:contact@escapedia.com?subject=${encodeURIComponent(
        'Intérêt pour ' + experience.title
      )}`;
      cta.className = 'button button--ghost';
      cta.textContent = 'En savoir plus';
      cta.setAttribute('aria-label', `En savoir plus sur ${experience.title}`);

      elements.push(cta);

      card.append(...elements);
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
