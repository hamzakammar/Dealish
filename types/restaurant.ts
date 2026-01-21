export type Restaurant = {
  id: string;
  name: string;
  lat: number;
  lng: number;
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

