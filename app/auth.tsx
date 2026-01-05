import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Complete the OAuth session in the browser
WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const { session, isLoading } = useAuthContext();

  // If already logged in, redirect to map
  if (session) {
    return <Redirect href="/map" />;
  }

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  const handleGoogleSignIn = async () => {
    try {
      // Always use the deep link scheme explicitly (not localhost)
      const redirectUrl = 'dealish://auth/callback';
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      // Open the OAuth URL in browser
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success') {
          // Parse the URL to extract the session
          const { url } = result;
          if (url) {
            // Extract the access token from the URL
            const urlParts = url.split('#');
            if (urlParts.length > 1) {
              const params = new URLSearchParams(urlParts[1]);
              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');
              
              if (accessToken && refreshToken) {
                // Set the session manually
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                
                if (sessionError) {
                  Alert.alert('Error', 'Failed to set session');
                }
              }
            }
          }
        } else if (result.type === 'cancel') {
          // User cancelled, do nothing
        } else {
          Alert.alert('Error', 'Authentication failed');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
    }
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Dealish</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <TouchableOpacity 
        style={[styles.button, styles.googleButton]} 
        onPress={handleGoogleSignIn}
      >
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});