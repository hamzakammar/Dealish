import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

export function useAccountNavigation() {
  const router = useRouter();
  return () => {
    try {
      router.push('/account');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to navigate. Please try again.');
    }
  };
}

export function useMapNavigation() {
  const router = useRouter();
  return () => {
    try {
      router.push('/map');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to navigate. Please try again.');
    }
  };
}
