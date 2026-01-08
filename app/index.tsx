import { useAuthContext } from '@/app/providers/auth';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { session, isLoading } = useAuthContext();
  const router = useRouter();

  // Use useEffect for navigation to avoid mounting/unmounting issues with Redirect
  useEffect(() => {
    // Always declare timeoutId at the top for consistent hook structure
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    // Wait until loading is complete before redirecting
    if (!isLoading) {
      // Use requestAnimationFrame to ensure redirect happens after render completes
      timeoutId = setTimeout(() => {
        if (isMounted) {
          if (session) {
            router.replace('/map');
          } else {
            router.replace('/auth');
          }
        }
      }, 0);
    }

    // ALWAYS return cleanup function for consistent hook structure
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [session, isLoading, router]);

  // Show loading while checking auth or during redirect
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#FE902A" />
    </View>
  );
}