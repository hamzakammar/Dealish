"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddressAutocomplete, { AddressResult } from "@/components/AddressAutocomplete";

export default function CreateRestaurantPage() {
  const supabase = createClient();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }
    setUserId(user.id);
    setLoading(false);
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setError("Restaurant name is required.");
      return false;
    }
    if (!latitude.trim() || !longitude.trim()) {
      setError(
        "Location is required. Enter latitude and longitude coordinates."
      );
      return false;
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      setError("Latitude and longitude must be valid numbers.");
      return false;
    }
    if (lat < -90 || lat > 90) {
      setError("Latitude must be between -90 and 90.");
      return false;
    }
    if (lng < -180 || lng > 180) {
      setError("Longitude must be between -180 and 180.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm() || !userId) return;

    try {
      setIsSaving(true);

      const payload = {
        owner_id: userId,
        name: name.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        phone: phone.trim() || null,
        type: type.trim() || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        hero_image_url: imageUrl.trim() || null,
        is_active: true,
      };

      const { data, error: insertError } = await supabase
        .from("restaurants")
        .insert([payload])
        .select("id")
        .single();

      if (insertError) {
        setError(
          `Failed to create restaurant: ${insertError.message || insertError.code || "Unknown error"}`
        );
        return;
      }

      if (!data) {
        setError(
          "Restaurant insert returned no row. Check RLS policies on the restaurants table."
        );
        return;
      }

      const restaurantId = data.id;

      // Register creator as the primary 'owner' member
      const { error: memberError } = await supabase.from("restaurant_members").insert({
        restaurant_id: restaurantId,
        user_id: userId,
        role: "owner",
      });

      if (memberError) {
        setError(`Restaurant created but failed to set up membership: ${memberError.message}`);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err: any) {
      setError(`Failed to create restaurant: ${err.message || String(err)}`);
    } finally {
      setIsSaving(false);
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
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="flex items-center justify-center h-10 w-10 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <svg
            className="h-5 w-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create Restaurant
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Add a new restaurant to your account
          </p>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700 font-medium">
            Restaurant created successfully! Redirecting...
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Basic Info</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Restaurant Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter restaurant name"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Address
            </label>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onSelect={(result: AddressResult) => {
                setAddress(result.address);
                setCity(result.city);
                setLatitude(String(result.lat));
                setLongitude(String(result.lng));
              }}
              placeholder="Street address"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g., Toronto, Canada"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Type
            </label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="e.g., Italian, Fast Food, Cafe"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
          </div>
        </div>

        {/* Location */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Location *</h2>
          <p className="text-sm text-gray-500">
            Enter the latitude and longitude coordinates for your restaurant.
          </p>

          {latitude && longitude && (
            <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2.5">
              <svg
                className="h-4 w-4 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm text-green-700 font-medium">
                {parseFloat(latitude).toFixed(6)},{" "}
                {parseFloat(longitude).toFixed(6)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Latitude
              </label>
              <input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g., 43.6532"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Longitude
              </label>
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g., -79.3832"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
              />
            </div>
          </div>
        </div>

        {/* Hero Image */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Hero Image</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
          </div>

          {imageUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <img
                src={imageUrl}
                alt="Restaurant hero preview"
                className="w-full h-40 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded-2xl bg-[#FE902A] px-6 py-4 text-base font-semibold text-white hover:bg-[#e5811f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating...
            </span>
          ) : (
            "Create Restaurant"
          )}
        </button>
      </form>
    </div>
  );
}
