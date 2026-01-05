import { Redirect } from 'expo-router';
import { useAuthContext } from '@/app/providers/auth';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { session, isLoading } = useAuthContext();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  // Redirect based on auth status
  if (session) {
    return <Redirect href="/map" />;
  } else {
    return <Redirect href="/auth" />;
  }
}