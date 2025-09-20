export function createCityCard(city) {
  const article = document.createElement('article');
  article.className = 'city-card';

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'city-card__image';
  const image = document.createElement('img');
  image.src = city.heroImage;
  image.alt = `Vue de ${city.name}`;
  image.loading = 'lazy';
  imageWrapper.appendChild(image);

  const eyebrow = document.createElement('span');
  eyebrow.className = 'tag';
  eyebrow.textContent = city.country;

  const title = document.createElement('h3');
  title.textContent = city.name;
  title.style.margin = '0';
  title.style.fontFamily = 'var(--font-heading)';

  const summary = document.createElement('p');
  summary.textContent = city.summary;
  summary.className = 'text-muted';

  const meta = document.createElement('div');
  meta.className = 'city-card__meta';
  meta.innerHTML = `<span>${city.experiences.length} expériences</span><span>${city.reviews.length} avis</span>`;

  const actions = document.createElement('div');
  actions.className = 'city-card__actions';

  const exploreBtn = document.createElement('a');
  exploreBtn.href = `city.html?city=${city.slug}`;
  exploreBtn.className = 'button button--primary';
  exploreBtn.textContent = `Explorer ${city.name}`;
  exploreBtn.setAttribute('aria-label', `Explorer la page dédiée à ${city.name}`);

  const tags = document.createElement('div');
  tags.className = 'city-card__tags';
  city.highlights.slice(0, 2).forEach((highlight) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = `${highlight.icon} ${highlight.title}`;
    tags.appendChild(span);
  });

  actions.append(exploreBtn);

  article.append(imageWrapper, eyebrow, title, summary, meta, tags, actions);
  return article;
}
