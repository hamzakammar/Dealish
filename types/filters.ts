export type FilterState = {
  maxDistance: number | null; // km, null = no limit
  minRating: number | null; // null = any rating
  types: string[]; // selected cuisine types
  partnerOnly: boolean;
  hasDealsOnly: boolean;
};

export const DEFAULT_FILTERS: FilterState = {
  maxDistance: null,
  minRating: null,
  types: [],
  partnerOnly: false,
  hasDealsOnly: false,
};

export const DISTANCE_OPTIONS = [
  { label: "All", value: null },
  { label: "1 km", value: 1 },
  { label: "5 km", value: 5 },
  { label: "10 km", value: 10 },
  { label: "25 km", value: 25 },
  { label: "50 km", value: 50 },
];

export const RATING_OPTIONS = [
  { label: "Any", value: null },
  { label: "4+ stars", value: 4 },
  { label: "4.5+ stars", value: 4.5 },
  { label: "5 stars", value: 5 },
];
