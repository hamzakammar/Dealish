import { useAuthContext } from "@/app/providers/auth";
import { useEffect, useState } from "react";

export function useProfileSetup() {
  const { profile, session } = useAuthContext();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !profile) {
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
  }, [profile, session]);

  return {
    isProfileComplete,
    loading,
    needsSetup: !loading && !isProfileComplete,
  };
}
