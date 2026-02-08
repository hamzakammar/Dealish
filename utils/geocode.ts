type GeocodingResult = {
  lat: number;
  lng: number;
  displayName: string;
};

/**
 * Geocode an address string to lat/lng using OpenStreetMap Nominatim.
 * Free, no API key required. Rate limit: 1 request/second.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const encoded = encodeURIComponent(address.trim());
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Dealish/1.0' },
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (!data || data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}
