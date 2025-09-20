# Escapedia

Escapedia est une vitrine web statique qui met en avant des city-breaks inspirants. L'application propose :

- une identité visuelle rafraîchie grâce à une palette de couleurs accessible, une typographie harmonisée et un système d'espacements cohérent ;
- une page d'accueil éditorialisée qui présente la promesse de la marque et un catalogue de destinations ;
- des pages villes riches en contenu (hero illustré, essentiels, conseils pratiques, expériences filtrables, avis voyageurs, carte interactive).

## Structure

```
.
├── index.html              # Page d'accueil
├── city.html               # Template d'une page ville (paramètre ?city=slug)
├── src
│   ├── data
│   │   └── cities.json     # Données structurées des destinations
│   ├── scripts             # Logique de rendu côté client
│   │   ├── city.js
│   │   ├── data.js
│   │   ├── main.js
│   │   └── components
│   │       └── cityCard.js
│   └── styles              # Styles et tokens de design
│       ├── city.css
│       ├── global.css
│       ├── home.css
│       └── theme.css
└── assets                  # Répertoires réservés aux médias locaux (actuellement vides)
```

Les images illustratives sont chargées depuis Unsplash pour simplifier le prototypage. Remplacez-les par vos visuels optimisés dans `assets/images` lorsque nécessaire.

## Lancement local

Comme il s'agit d'un site statique, un simple serveur HTTP suffit :

```bash
python3 -m http.server 5173
```

Ensuite, rendez-vous sur [http://localhost:5173](http://localhost:5173) et naviguez vers `index.html` pour découvrir Escapedia. La navigation vers une ville se fait via `city.html?city=paris` (ou `lisbonne`, `kyoto`).

## Personnalisation

- **Palette & thème** : ajustez les variables CSS dans `src/styles/theme.css`.
- **Contenus** : enrichissez `src/data/cities.json` avec de nouvelles villes, expériences ou avis.
- **Composants** : adaptez le rendu des cartes et sections dans `src/scripts/components/` et `src/scripts/city.js`.

### Format des expériences enrichies

Les objets listés dans `experiences` peuvent désormais stocker des métadonnées issues de Google Maps ou de vos repérages terrain. Ces champs restent optionnels, mais ils facilitent l'affichage des informations clés (adresse, note, statut), la génération de liens cartographiques et la déduplication lors d'import automatisé grâce au `placeId`.

```json
{
  "id": "louvre",
  "title": "Explorez le Louvre avec un guide expert",
  "category": "Culture",
  "duration": "3 heures",
  "description": "...",
  "image": "https://...",
  "imageUrl": "https://...",
  "placeId": "ChIJ...",
  "address": "Rue de Rivoli, 75001 Paris, France",
  "latitude": 48.8606,
  "longitude": 2.3376,
  "rating": 4.7,
  "ratingsTotal": 132458,
  "status": "Ouvert actuellement",
  "source": {
    "name": "Google Maps",
    "url": "https://maps.app.goo.gl/...",
    "retrievedAt": "2024-03"
  }
}
```

- **Compatibilité** : `category` reste requis pour alimenter le système de filtres, et `image` peut toujours être utilisé comme repli si `imageUrl` est absent.
- **Durée facultative** : laissez le champ vide ou à `null` lorsqu'une expérience n'a pas de durée fixe ; l'interface affiche alors un message de repli.
- **Identifiant lieu (`placeId`)** : privilégiez l'identifiant Google Places lorsque disponible pour éviter les doublons lors des synchronisations.
- **Source** : conservez la provenance des données (`name`, `url`, `retrievedAt`) pour faciliter les mises à jour ultérieures.

## Accessibilité & bonnes pratiques

- Contrastes vérifiés pour répondre aux recommandations WCAG AA.
- États focus visibles pour la navigation clavier.
- Structure sémantique avec titres hiérarchisés et balises ARIA pertinentes.

N'hésitez pas à compléter par des tests automatisés, un pipeline de build ou une intégration à votre stack existante selon vos besoins.
