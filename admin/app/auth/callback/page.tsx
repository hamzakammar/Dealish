"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Check for OAuth errors in URL params
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    const errorParam = hashParams.get("error") || searchParams.get("error");
    const errorDescription =
      hashParams.get("error_description") || searchParams.get("error_description");

    if (errorParam) {
      setError(errorDescription || errorParam);
      setTimeout(() => router.push("/"), 3000);
      return;
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.push("/dashboard");
      }
    });

    // Handle the hash fragment from OAuth redirect
    const accessToken = hashParams.get("access_token");
    if (accessToken) {
      // Token in URL means Supabase will pick it up via onAuthStateChange
      // Give it a moment then redirect
      setTimeout(() => router.push("/dashboard"), 500);
    }

    // Timeout: if no auth event after 5 seconds, redirect to login
    const timeout = setTimeout(() => {
      router.push("/");
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <>
            <div className="rounded-xl bg-red-50 border border-red-200 px-6 py-4 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FE902A] mx-auto" />
            <p className="mt-4 text-sm text-gray-500">Signing you in...</p>
          </>
        )}
      </div>
    </div>
  );
}
