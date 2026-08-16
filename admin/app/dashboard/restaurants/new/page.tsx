"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddressAutocomplete, { AddressResult } from "@/components/AddressAutocomplete";

// Matches the restaurant-images bucket config (setup_restaurant_images_storage.sql).
const RESTAURANT_IMAGES_BUCKET = "restaurant-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

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

  // Direct upload state (the URL field still works as an alternative).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  // Revoke the object URL preview when it changes / on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file later.
    e.target.value = "";
    if (!file) return;

    setUploadError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Unsupported format. Use JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 5 MB.`);
      return;
    }

    // Immediate local preview while the upload runs.
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    setUploadState("uploading");

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const fileName = `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      // Uploaded with the authenticated anon-key client — Storage RLS on the
      // restaurant-images bucket governs who may write. No service-role key here.
      const { data, error: uploadErr } = await supabase.storage
        .from(RESTAURANT_IMAGES_BUCKET)
        .upload(fileName, file, { contentType: file.type, upsert: false });

      if (uploadErr) {
        const msg = uploadErr.message || "";
        setUploadError(
          msg.toLowerCase().includes("bucket") || msg.toLowerCase().includes("not found")
            ? "Storage bucket 'restaurant-images' isn't configured. See setup_restaurant_images_storage.sql."
            : msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("policy")
            ? "You don't have permission to upload images. Check the restaurant-images Storage policy."
            : `Upload failed: ${msg}`
        );
        setUploadState("error");
        return;
      }

      const { data: pub } = supabase.storage.from(RESTAURANT_IMAGES_BUCKET).getPublicUrl(data.path);
      // Store the public URL in the same field URL-based images use.
      setImageUrl(pub.publicUrl);
      setUploadState("idle");
    } catch (err: any) {
      setUploadError(`Upload failed: ${err?.message || String(err)}`);
      setUploadState("error");
    }
  };

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
    // Location is captured from the selected address suggestion, not entered by hand.
    if (!latitude.trim() || !longitude.trim()) {
      setError(
        "Please pick your restaurant's address from the dropdown suggestions so we can place it on the map."
      );
      return false;
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setError("That address couldn't be located. Please choose a different suggestion.");
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
        lat: parseFloat(latitude),
        lng: parseFloat(longitude),
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
              Address *
            </label>
            <AddressAutocomplete
              value={address}
              onChange={(v) => {
                setAddress(v);
                // Typing after a selection invalidates the captured location until
                // a suggestion is picked again.
                setLatitude("");
                setLongitude("");
              }}
              onSelect={(result: AddressResult) => {
                setAddress(result.address);
                setCity(result.city);
                setLatitude(String(result.lat));
                setLongitude(String(result.lng));
              }}
              placeholder="Start typing and pick your restaurant"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
            {latitude && longitude ? (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-green-700">
                <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Location confirmed
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-500">
                Pick your restaurant from the suggestions to set its location.
              </p>
            )}
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

        {/* Hero Image */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Hero Image</h2>

          {/* Upload from device */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Upload an image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadState === "uploading"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:border-[#FE902A] hover:text-[#FE902A] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {uploadState === "uploading" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#FE902A]" />
                  Uploading…
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 9l5-5 5 5M12 4v12" />
                  </svg>
                  Choose an image
                </>
              )}
            </button>
            <p className="mt-2 text-xs text-gray-500">JPEG, PNG, or WebP · up to 5 MB.</p>
            {uploadError && (
              <p className="mt-2 text-sm text-red-600">{uploadError}</p>
            )}
            {uploadState === "idle" && imageUrl && localPreview && !uploadError && (
              <p className="mt-2 text-sm text-green-700">Image uploaded ✓</p>
            )}
          </div>

          {/* Or paste a URL */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">or paste a URL</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                // A typed URL supersedes any uploaded-file preview.
                if (localPreview) {
                  URL.revokeObjectURL(localPreview);
                  setLocalPreview(null);
                }
              }}
              placeholder="https://..."
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
          </div>

          {(localPreview || imageUrl) && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <img
                src={localPreview || imageUrl}
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
