"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";

export type AddressResult = {
  address: string;
  city: string;
  province: string;
  postalCode: string;
  lat: number;
  lng: number;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  className?: string;
};

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address...",
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    if (autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      fields: ["address_components", "geometry", "formatted_address"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.address_components) return;

      let streetNumber = "";
      let route = "";
      let city = "";
      let province = "";
      let postalCode = "";

      for (const component of place.address_components) {
        const types = component.types;
        if (types.includes("street_number")) {
          streetNumber = component.long_name;
        } else if (types.includes("route")) {
          route = component.long_name;
        } else if (types.includes("locality")) {
          city = component.long_name;
        } else if (types.includes("administrative_area_level_1")) {
          province = component.short_name;
        } else if (types.includes("postal_code")) {
          postalCode = component.long_name;
        }
      }

      const address = streetNumber ? `${streetNumber} ${route}` : route;
      const lat = place.geometry.location?.lat() ?? 0;
      const lng = place.geometry.location?.lng() ?? 0;

      onChange(address || place.formatted_address || "");
      onSelect({ address: address || place.formatted_address || "", city, province, postalCode, lat, lng });
    });

    autocompleteRef.current = autocomplete;
  }, [onChange, onSelect]);

  useEffect(() => {
    if (scriptLoaded) {
      initAutocomplete();
    }
  }, [scriptLoaded, initAutocomplete]);

  // Also try to init if google is already loaded (e.g. script cached)
  useEffect(() => {
    if (window.google?.maps?.places) {
      setScriptLoaded(true);
    }
  }, []);

  const defaultClassName =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]";

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="lazyOnload"
        onLoad={() => setScriptLoaded(true)}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className || defaultClassName}
      />
      <style jsx global>{`
        .pac-container {
          background-color: white;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
          margin-top: 4px;
          padding: 4px 0;
          font-family: inherit;
          z-index: 9999;
        }
        .pac-item {
          padding: 8px 16px;
          font-size: 14px;
          color: #374151;
          cursor: pointer;
          border-top: none;
          line-height: 1.5;
        }
        .pac-item:first-child {
          border-top: none;
        }
        .pac-item:hover {
          background-color: #fff7ed;
        }
        .pac-item-selected {
          background-color: #fff7ed;
        }
        .pac-icon {
          display: none;
        }
        .pac-item-query {
          font-size: 14px;
          color: #111827;
          font-weight: 500;
        }
        .pac-matched {
          font-weight: 600;
          color: #FE902A;
        }
      `}</style>
    </>
  );
}
