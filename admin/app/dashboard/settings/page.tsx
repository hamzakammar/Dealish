"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AddressAutocomplete, { AddressResult } from "@/components/AddressAutocomplete";

type Restaurant = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  cuisine_type: string | null;
  hero_image_url: string | null;
  display_image: string | null;
  rating: number | null;
  num_ratings: number | null;
  phone: string | null;
  type: string | null;
};

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [displayImage, setDisplayImage] = useState("");

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurantId) {
      loadRestaurant();
    }
  }, [selectedRestaurantId]);

  const fetchRestaurants = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }

    const { data: memberData } = await supabase
      .from("restaurant_members")
      .select("restaurant:restaurant_id(*)")
      .eq("user_id", user.id)
      .eq("role", "owner");

    const list = ((memberData || []) as any[])
      .map((m) => m.restaurant)
      .filter(Boolean) as Restaurant[];

    const sortedList = list.sort((a, b) => a.name.localeCompare(b.name));

    setRestaurants(sortedList);
    if (sortedList.length > 0) {
      setSelectedRestaurantId(sortedList[0].id);
    }
    setLoading(false);
  };

  const loadRestaurant = () => {
    const r = restaurants.find((r) => r.id === selectedRestaurantId);
    if (!r) return;
    setName(r.name || "");
    setAddress(r.address || "");
    setCity(r.city || "");
    setProvince(r.province || "");
    setPostalCode(r.postal_code || "");
    setPhone(r.phone || "");
    setCuisineType(r.cuisine_type || r.type || "");
    setHeroImageUrl(r.hero_image_url || "");
    setDisplayImage(r.display_image || "");
  };

  const handleSave = async () => {
    if (!selectedRestaurantId || !name.trim()) return;
    setSaving(true);
    setSuccess(false);
    setError(null);

    const { error: saveError } = await supabase
      .from("restaurants")
      .update({
        name: name.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        province: province.trim() || null,
        postal_code: postalCode.trim() || null,
        phone: phone.trim() || null,
        cuisine_type: cuisineType.trim() || null,
        hero_image_url: heroImageUrl.trim() || null,
        display_image: displayImage.trim() || null,
      })
      .eq("id", selectedRestaurantId);

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
    } else {
      setSuccess(true);
      // Update local state
      setRestaurants(
        restaurants.map((r) =>
          r.id === selectedRestaurantId
            ? {
                ...r,
                name: name.trim(),
                address: address.trim() || null,
                city: city.trim() || null,
                province: province.trim() || null,
                postal_code: postalCode.trim() || null,
                phone: phone.trim() || null,
                cuisine_type: cuisineType.trim() || null,
                hero_image_url: heroImageUrl.trim() || null,
                display_image: displayImage.trim() || null,
              }
            : r
        )
      );
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FE902A]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Restaurant Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Update your restaurant information
          </p>
        </div>
        {restaurants.length > 1 && (
          <select
            value={selectedRestaurantId || ""}
            onChange={(e) => setSelectedRestaurantId(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Basic Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Restaurant Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                placeholder="Restaurant name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cuisine Type
              </label>
              <input
                value={cuisineType}
                onChange={(e) => setCuisineType(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                placeholder="e.g., Italian, Fast Food, Cafe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                placeholder="Phone number"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Location
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onSelect={(result: AddressResult) => {
                  setAddress(result.address);
                  setCity(result.city);
                  setProvince(result.province);
                  setPostalCode(result.postalCode);
                }}
                placeholder="123 Main St"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Province
                </label>
                <input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                  placeholder="Province"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postal Code
              </label>
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                placeholder="A1B 2C3"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Images
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hero Image URL
              </label>
              <input
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                placeholder="https://..."
              />
              {heroImageUrl && (
                <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
                  <img
                    src={heroImageUrl}
                    alt="Hero preview"
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Image URL
              </label>
              <input
                value={displayImage}
                onChange={(e) => setDisplayImage(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                placeholder="https://..."
              />
              {displayImage && (
                <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
                  <img
                    src={displayImage}
                    alt="Display preview"
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rating (read-only) */}
        {restaurants.find((r) => r.id === selectedRestaurantId)?.rating && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Rating & Reviews
            </h2>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-gray-500">Rating</p>
                <p className="text-lg font-bold text-gray-900">
                  {restaurants
                    .find((r) => r.id === selectedRestaurantId)
                    ?.rating?.toFixed(1)}{" "}
                  / 5
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Reviews</p>
                <p className="text-lg font-bold text-gray-900">
                  {restaurants.find((r) => r.id === selectedRestaurantId)
                    ?.num_ratings || 0}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Ratings are sourced from Google and cannot be edited here.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded-xl bg-[#FE902A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#e5811f] disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {success && (
            <span className="text-sm text-green-600 font-medium">
              Saved successfully
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
