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

// Distance options are now defined directly in FilterPanel for flexibility
