export type Restaurant = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  partner?: boolean;
  description?: string;
  address?: string;
  phone?: string;
  type?: string;
  rating?: number;
  // DB column names
  num_ratings?: number;
  hero_image_url?: string;
  display_image?: string;
  // Mapped aliases used in UI (populated by useRestaurants / AccountPanel)
  rating_count?: number;
  image_url?: string;
  logo_url?: string;
};

export type Deal = {
  id: string;
  restaurant_id: string;
  title: string;
  description?: string;
  tags?: string[];
  discount_type?: 'percent' | 'fixed' | 'bogo'; // Type of discount offered
  discount_value?: number; // Percentage (0-100) for percent, dollar amount for fixed
  original_price?: number; // Original price before discount (for fixed savings calculation)
  savings_amount?: number | string; // Server-calculated savings (Thin Client refactor)
  start_at?: string;
  end_at?: string;
  is_active: boolean;
  is_recurring?: boolean;
  recurrence_days?: number[]; // Array of day numbers (0=Sunday, 1=Monday, etc.)
  recurrence_start_time?: string; // Time string in format "HH:MM:SS"
  recurrence_end_time?: string; // Time string in format "HH:MM:SS"
  source?: 'manual' | 'sheets' | 'scraped'; // Where the deal originated; 'sheets' rows are skipped by sheets-outbound; 'scraped' = auto-detected by the deal agent (renders an "unverified" badge)
  source_url?: string; // For scraped deals: the page the deal was read from
  confidence?: number; // For scraped deals: 0..1 extraction confidence
  last_verified_at?: string;
  created_at: string;
  updated_at: string;
};

export type MapType = "standard" | "satellite" | "hybrid" | "terrain";

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type UserLocation = {
  lat: number;
  lng: number;
};
