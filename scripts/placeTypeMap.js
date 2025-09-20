const TYPE_CATEGORY_MAP = {
  museum: 'Culture',
  art_gallery: 'Culture',
  tourist_attraction: 'Culture',
  historical_landmark: 'Culture',
  monument: 'Culture',
  church: 'Culture',
  hindu_temple: 'Culture',
  mosque: 'Culture',
  synagogue: 'Culture',
  place_of_worship: 'Culture',
  library: 'Culture',
  restaurant: 'Gastronomie',
  food: 'Gastronomie',
  cafe: 'Gastronomie',
  bakery: 'Gastronomie',
  meal_takeaway: 'Gastronomie',
  meal_delivery: 'Gastronomie',
  bar: 'Vie nocturne',
  night_club: 'Vie nocturne',
  park: 'Nature',
  natural_feature: 'Nature',
  campground: 'Nature',
  zoo: 'Nature',
  botanical_garden: 'Nature',
  tourist_information_center: 'Pratique',
  point_of_interest: 'Découverte',
  establishment: 'Découverte'
};

const FALLBACK_CATEGORY = 'Découverte';

function mapPlaceTypesToCategory(types = []) {
  for (const type of types) {
    const category = TYPE_CATEGORY_MAP[type];
    if (category) {
      return category;
    }
  }
  return FALLBACK_CATEGORY;
}

module.exports = {
  TYPE_CATEGORY_MAP,
  FALLBACK_CATEGORY,
  mapPlaceTypesToCategory
};
