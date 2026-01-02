export type Restaurant = {
  id: string;
  name: string;
  lat: number;
  lng: number;
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

