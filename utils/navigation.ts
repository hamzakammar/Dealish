import { router } from 'expo-router';

/**
 * Safe navigation wrapper that handles errors gracefully
 */
export const safeNavigate = {
  push: (path: string | { pathname: string; params?: any }) => {
    try {
      if (typeof path === 'string') {
        router.push(path as any);
      } else {
        router.push(path as any);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback navigation
      try {
        router.push('/map' as any);
      } catch (fallbackError) {
        console.error('Fallback navigation failed:', fallbackError);
      }
    }
  },
  
  replace: (path: string | { pathname: string; params?: any }) => {
    try {
      if (typeof path === 'string') {
        router.replace(path as any);
      } else {
        router.replace(path as any);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback navigation
      try {
        router.replace('/map' as any);
      } catch (fallbackError) {
        console.error('Fallback navigation failed:', fallbackError);
      }
    }
  },
  
  back: () => {
    try {
      router.back();
    } catch (error) {
      console.error('Navigation back error:', error);
      // Fallback to map
      try {
        router.replace('/map' as any);
      } catch (fallbackError) {
        console.error('Fallback navigation failed:', fallbackError);
      }
    }
  },
};
