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

    // If we have a session but no profile yet, keep loading
    // But don't block navigation - profile can load in background
    if (!profile) {
      // Set loading to false after a short timeout to prevent blocking
      const timeout = setTimeout(() => {
        setLoading(false);
        setIsProfileComplete(false);
      }, 500);
      return () => clearTimeout(timeout);
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
