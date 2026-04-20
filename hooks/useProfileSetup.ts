import { useAuthContext } from "@/app/providers/auth";
import { useEffect, useState } from "react";

export function useProfileSetup() {
  const { profile, session, isLoading: authLoading } = useAuthContext();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If no session, immediately mark as not loading
    if (!session) {
      setLoading(false);
      setIsProfileComplete(false);
      return;
    }

    // Wait for auth provider to finish loading profile instead of arbitrary timeout.
    // The auth provider tracks its own loading state — trust it.
    if (authLoading) {
      setLoading(true);
      return;
    }

    // Auth finished loading but profile is null — new user or profile fetch failed.
    // Treat as incomplete so they go through onboarding.
    if (!profile) {
      setLoading(false);
      setIsProfileComplete(false);
      return;
    }

    // Check if profile is complete
    // Profile is considered complete if both name and location are set
    const hasName = !!profile.display_name && profile.display_name.trim().length > 0;
    const hasLocation = !!profile.location && profile.location.trim().length > 0;

    setIsProfileComplete(hasName && hasLocation);
    setLoading(false);
  }, [profile, session, authLoading]);

  return {
    isProfileComplete,
    loading,
    needsSetup: !loading && !isProfileComplete,
  };
}
