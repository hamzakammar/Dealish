import { useRouter } from 'expo-router';

export function useAccountNavigation() {
  const router = useRouter();
  return () => router.push('/account');
}

export function useMapNavigation() {
  const router = useRouter();
  return () => router.push('/map');
}
