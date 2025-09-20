# Synchronisation des activités avec Google Places

Ce projet fournit un script Node.js (`scripts/updatePlaces.mjs`) pour enrichir les activités d'une destination à partir de Google Places. Il peut être exécuté depuis la racine du dépôt et nécessite une clé API Google disposant des droits **Places API - Text Search**, **Place Details** et **Place Photos**.

```bash
GOOGLE_API_KEY="<votre-cle>" node scripts/updatePlaces.mjs <ville> [pays]
```

## Variables d'environnement

| Nom | Description | Valeur par défaut |
| --- | --- | --- |
| `GOOGLE_API_KEY` | Clé API utilisée pour l'authentification. | *(obligatoire)* |
| `GOOGLE_TEXT_DELAY_MS` | Délai entre deux requêtes Text Search pour éviter les limites de quota. | `1000` |
| `GOOGLE_DETAILS_DELAY_MS` | Délai entre deux requêtes Place Details. | `1000` |
| `GOOGLE_PHOTO_DELAY_MS` | Délai entre deux téléchargements de photo. | `1500` |
| `GOOGLE_MAX_PAGES` | Nombre maximum de pages Text Search à parcourir. | `3` |
| `GOOGLE_LANGUAGE` | Langue préférée pour les résultats (code BCP 47). | `fr` |

## Typologie des lieux

Le mapping entre les types Google et les catégories internes est défini dans [`scripts/placeTypeMap.js`](placeTypeMap.js). Modifiez-le pour ajuster les catégories éditoriales.

## Fusion des données

Le script normalise chaque résultat Google et le fusionne avec les activités existantes dans [`src/data/cities.json`](../src/data/cities.json). La fusion se base sur `placeId` afin de dédupliquer les entrées ; les activités existantes sont enrichies si de nouvelles informations sont disponibles. Les villes et activités restent triées alphabétiquement.

## Journalisation

Chaque exécution consigne dans la sortie standard les ajouts, mises à jour et les entrées ignorées. En cas de dépassement de quota, le script se met en pause pendant la durée recommandée avant de reprendre.

