import { useAuthContext } from "@/app/providers/auth";
import { useEffect, useState } from "react";

export function useProfileSetup() {
  const { profile, session } = useAuthContext();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If no session, immediately mark as not loading
    if (!session) {
      setLoading(false);
      setIsProfileComplete(false);
      return;
    }

    // Session exists but profile hasn't loaded yet — stay in loading state.
    // The auth provider WILL deliver the profile; we just need to wait.
    if (!profile) {
      // Safety timeout: if profile never arrives after 3s, assume complete
      // so a returning user isn't stuck on a loading screen or sent to onboarding.
      const safetyTimeout = setTimeout(() => {
        setLoading(false);
        setIsProfileComplete(true);
      }, 3000);
      return () => clearTimeout(safetyTimeout);
    }

    // Check if profile is complete
    // Profile is considered complete if both name and location are set
    const hasName = !!profile.display_name && profile.display_name.trim().length > 0;
    const hasLocation = !!profile.location && profile.location.trim().length > 0;

    setIsProfileComplete(hasName && hasLocation);
    setLoading(false);
  }, [profile, session]);

  return {
    isProfileComplete,
    loading,
    needsSetup: !loading && !isProfileComplete,
  };
}
