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
  rating_count?: number;
  image_url?: string;
  logo_url?: string;
  display_image?: string;
};

export type Deal = {
  id: string;
  restaurant_id: string;
  title: string;
  description?: string;
  tags?: string[];
  start_at?: string;
  end_at?: string;
  is_active: boolean;
  is_recurring?: boolean;
  recurrence_days?: number[]; // Array of day numbers (0=Sunday, 1=Monday, etc.)
  recurrence_start_time?: string; // Time string in format "HH:MM:SS"
  recurrence_end_time?: string; // Time string in format "HH:MM:SS"
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

