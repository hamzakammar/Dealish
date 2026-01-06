import { getAuthRedirectUrl, supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { checkRateLimit, clearRateLimit, formatRemainingTime, recordFailedAttempt } from '@/utils/rateLimit';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import validator from 'validator';

// Complete the OAuth session in the browser
WebBrowser.maybeCompleteAuthSession();

const validateEmail = (email: string) => {
    return validator.isEmail(email);
  };
  

export default function AuthScreen() {
  const { session, isLoading } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // If already logged in, redirect to map
  if (session) {
    return <Redirect href="/map" />;
  }

  // Check rate limit on mount
  useEffect(() => {
    const checkLimit = async () => {
      const { allowed, remainingTime } = await checkRateLimit();
      if (!allowed && remainingTime) {
        setIsRateLimited(true);
        setRateLimitError(
          `Too many failed attempts. Please try again in ${formatRemainingTime(remainingTime)}.`
        );
      }
    };
    checkLimit();
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }
  const handleEmailAuth = async () => {
    // Reset errors
    setEmailError('');
    setPasswordError('');
    setRateLimitError(null);

    // Check rate limit first
    const { allowed, remainingTime } = await checkRateLimit();
    if (!allowed) {
      setIsRateLimited(true);
      if (remainingTime) {
        setRateLimitError(
          `Too many failed attempts. Please try again in ${formatRemainingTime(remainingTime)}.`
        );
      } else {
        setRateLimitError('Too many failed attempts. Please try again later.');
      }
      return;
    }

    setIsRateLimited(false);
  
    // Validate email
    if (!email) {
      setEmailError('Email is required');
      return;
    }
  
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
  
    // Validate password
    if (!password) {
      setPasswordError('Password is required');
      return;
    }
  
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
  
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
  
        if (error) {
          await recordFailedAttempt();
          Alert.alert('Error', error.message);
        } else {
          // Clear rate limit on success
          await clearRateLimit();
          Alert.alert(
            'Success', 
            'Check your email for the confirmation link!'
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
  
        if (error) {
          await recordFailedAttempt();
          Alert.alert('Error', error.message);
          
          // Re-check rate limit after failure
          const limitCheck = await checkRateLimit();
          if (!limitCheck.allowed && limitCheck.remainingTime) {
            setIsRateLimited(true);
            setRateLimitError(
              `Too many failed attempts. Please try again in ${formatRemainingTime(limitCheck.remainingTime)}.`
            );
          }
        } else {
          // Clear rate limit on success
          await clearRateLimit();
        }
      }
    } catch (error: any) {
      await recordFailedAttempt();
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };
  const handleGoogleSignIn = async () => {
    try {
      // Always use the deep link scheme explicitly (not localhost)
      const redirectUrl = getAuthRedirectUrl();

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
          //Supabase has automatic session handling
        } else if (result.type === 'cancel') {
          // User cancelled, do nothing
        } else {
          Alert.alert('Error', 'Authentication failed');
        }
      }
    } catch (error: unknown) {
        let errorMessage = 'Failed to sign in with Google';
        if (error instanceof Error && error.message) {
          errorMessage = error.message;
        } else if (typeof error === 'string' && error) {
          errorMessage = error;
        }
        Alert.alert('Error', errorMessage);
    }
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Take advantage of this deal</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <View style={styles.form}>
        {rateLimitError && (
          <View style={styles.rateLimitContainer}>
            <Text style={styles.rateLimitText}>{rateLimitError}</Text>
          </View>
        )}

        <View>
            <TextInput
            style={[
                styles.input,
                emailError && styles.inputError,
                isRateLimited && styles.inputDisabled
            ]}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={(text) => {
                setEmail(text);
                // Clear error when user starts typing
                if (emailError) setEmailError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isRateLimited}
            />
            {emailError && (
            <Text style={styles.errorText}>{emailError}</Text>
            )}
        </View>

        <View>
            <TextInput
            style={[
                styles.input,
                passwordError && styles.inputError,
                isRateLimited && styles.inputDisabled
            ]}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={(text) => {
                setPassword(text);
                // Clear error when user starts typing
                if (passwordError) setPasswordError('');
            }}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            editable={!isRateLimited}
            />
            {passwordError && (
            <Text style={styles.errorText}>{passwordError}</Text>
            )}
        </View>

        <TouchableOpacity 
          style={[
            styles.button, 
            styles.emailButton, 
            (loading || isRateLimited) && styles.buttonDisabled
          ]} 
          onPress={handleEmailAuth}
          disabled={loading || isRateLimited}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setIsSignUp(!isSignUp)}
          style={styles.toggleButton}
        >
          <Text style={styles.toggleText}>
            {isSignUp 
              ? 'Already have an account? Sign in' 
              : "Don't have an account? Sign up"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity 
        style={[styles.button, styles.googleButton]} 
        onPress={handleGoogleSignIn}
      >
        <Text style={styles.googleButtonText}>Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Manrope',
    fontWeight: 'normal',
    marginTop: 99,
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,

    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  emailButton: {
    backgroundColor: '#FE902A',
  },
  googleButton: {
    backgroundColor: '#E9EAEB',
    borderRadius: 8,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  toggleText: {
    color: '#666',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  inputError: {
    borderColor: '#ff4444',
    borderWidth: 1,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
  rateLimitContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  rateLimitText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
});