import * as SplashScreen from 'expo-splash-screen'
import { useAuthContext } from '@/app/providers/auth' // ← Fix the import path

void SplashScreen.preventAutoHideAsync()

export function SplashScreenController() {
  const { isLoading } = useAuthContext()

  if (!isLoading) {
    SplashScreen.hideAsync()
  }

  return null
}