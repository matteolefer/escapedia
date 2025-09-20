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

## Mise à jour des activités via Google Places

Un script Node.js permet de compléter automatiquement les activités d'une ville à partir de Google Places. Avant l'exécution, fournissez votre clé API via la variable d'environnement `GOOGLE_API_KEY` (Text Search, Details et Photos doivent être activés côté Google Cloud).

```bash
GOOGLE_API_KEY="votre-cle" node scripts/updatePlaces.mjs <ville> [pays]
```

Par exemple : `GOOGLE_API_KEY="..." node scripts/updatePlaces.mjs bangkok thailande`. Le script interroge les musées, monuments, restaurants et
parcs liés à la destination, normalise les résultats (`title`, `category`, `address`, `latitude`, `longitude`, `rating`, `ratingsTotal`, `status`,
`imageUrl`, `placeId`) puis fusionne ces activités avec celles déjà présentes dans `src/data/cities.json`. Les entrées sont triées
alphabétiquement et les activités existantes sont enrichies quand de nouvelles informations sont disponibles.

Un mapping des types Google → catégories internes est centralisé dans `scripts/placeTypeMap.js`. Adaptez-le selon les besoins éditoriaux. Pour
respecter les quotas de l'API, des délais sont appliqués entre les requêtes (surchargés via `GOOGLE_TEXT_DELAY_MS`, `GOOGLE_DETAILS_DELAY_MS`,
`GOOGLE_PHOTO_DELAY_MS`). Le script consigne dans la sortie standard les ajouts et mises à jour réalisés.

## Accessibilité & bonnes pratiques

- Contrastes vérifiés pour répondre aux recommandations WCAG AA.
- États focus visibles pour la navigation clavier.
- Structure sémantique avec titres hiérarchisés et balises ARIA pertinentes.

N'hésitez pas à compléter par des tests automatisés, un pipeline de build ou une intégration à votre stack existante selon vos besoins.
