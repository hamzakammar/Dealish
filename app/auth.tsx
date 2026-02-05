import { getAuthRedirectUrl, supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { checkRateLimit, clearRateLimit, formatRemainingTime, recordFailedAttempt } from '@/utils/rateLimit';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image, Platform, StyleSheet,
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
  const { session, isLoading, refetchProfile } = useAuthContext();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'user' | 'owner'>('user');
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const redirectingRef = useRef(false);

  // ALL hooks must be called BEFORE any conditional returns, in consistent order
  
  // First useEffect: Check rate limit on mount
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

  // Second useEffect: If already logged in, redirect to map (only redirect once)
  // Must be called consistently on every render, BEFORE any returns
  useEffect(() => {
    // Always declare timeoutId at the top for consistent hook structure
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Only redirect if we're loaded, have a session, and haven't already initiated redirect
    if (!isLoading && session && !redirectingRef.current) {
      redirectingRef.current = true;
      
      // Check if user has preferred_role in metadata and set it to profile
      const checkAndSetRole = async () => {
        try {
          const preferredRole = session.user.user_metadata?.preferred_role;
          if (preferredRole && (preferredRole === 'user' || preferredRole === 'owner')) {
            // Check current profile role
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
            
            // If profile doesn't have a role set, use the preferred role from metadata
            if (profile && !profile.role) {
              await supabase
                .from('profiles')
                .update({ role: preferredRole })
                .eq('id', session.user.id);
            }
          }
        } catch (error) {
          console.error('Error checking/setting role:', error);
        }
      };
      
      checkAndSetRole();
      
      // Use setTimeout with 0 delay to ensure redirect happens after render completes
      timeoutId = setTimeout(() => {
        router.replace('/map');
      }, 0);
    }

    // ALWAYS return cleanup function for consistent hook structure
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [session, isLoading, router]);

  // NOW we can do conditional returns - but show loading instead of null to keep component mounted
  // Show loading state or if already logged in (during redirect)
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  // If we have a session, show loading while redirecting (don't return null to keep hooks consistent)
  if (session) {
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

    // For sign-up, show role selection if not already shown
    if (isSignUp && !showRoleSelection) {
      setShowRoleSelection(true);
      return;
    }
  
    setLoading(true);
    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        });
  
        if (error) {
          await recordFailedAttempt();
          Alert.alert('Error', error.message);
        } else {
          // Clear rate limit on success
          await clearRateLimit();
          // For sign-up, check if email confirmation is required
          // If not required, user is automatically signed in
          const { data: { session } } = await supabase.auth.getSession();
          if (session && data.user) {
            // Update profile with selected role
            const { error: profileError } = await supabase
              .from('profiles')
              .update({ role: selectedRole })
              .eq('id', data.user.id);

            if (profileError) {
              console.error('Error updating profile role:', profileError);
              // Continue anyway - role can be updated later
            }

            // Refresh profile in auth context to ensure it's up to date
            await refetchProfile();

            // User is signed in immediately, redirect based on role
            setTimeout(() => {
              if (selectedRole === 'owner') {
                router.replace('/admin');
              } else {
                router.replace('/map');
              }
            }, 200);
          } else {
            // Email confirmation required
            // Store role preference in user metadata so we can set it after confirmation
            if (data.user) {
              const { error: metadataError } = await supabase.auth.updateUser({
                data: { preferred_role: selectedRole }
              });
              if (metadataError) {
                console.error('Error storing role preference:', metadataError);
              }
            }
            Alert.alert(
              'Success', 
              'Check your email for the confirmation link!'
            );
          }
        }
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
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
          
          // Fetch profile to check role
          await refetchProfile();
          
          // Get updated profile to check role
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', signInData.user.id)
            .single();
          
          // Redirect based on role after successful sign-in
          // Small delay to ensure session is fully set and profile is refreshed
          setTimeout(() => {
            if (profile?.role === 'owner' || profile?.role === 'admin') {
              router.replace('/admin');
            } else {
              router.replace('/map');
            }
          }, 200);
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
    // Only allow OAuth in client-side browser/native environments (not during static export)
    if (typeof window === 'undefined') {
      Alert.alert('Error', 'OAuth is not available in this environment.');
      return;
    }

    try {
      // On native, skip browser redirect and handle manually with WebBrowser
      // On web, let Supabase handle it
      const isNative = Platform.OS !== 'web';

      let redirectUrl: string;
      try {
        // Only generate redirect URL in client-side contexts
        if (isNative) {
          redirectUrl = getAuthRedirectUrl();
        } else {
          // On web, use current origin
          redirectUrl = window.location.origin;
        }
      } catch (err) {
        // If we're in a server environment, show error
        Alert.alert('Error', 'OAuth is not available in this environment.');
        return;
      }

      if (!redirectUrl) {
        Alert.alert('Error', 'Could not determine redirect URL. Please try again.');
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative, // Skip redirect on native, use WebBrowser instead
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      // On native, use WebBrowser to handle OAuth flow
      // On web, Supabase will handle the redirect automatically
      if (isNative && data.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
            // OAuth flow completed in the browser
            // On native with skipBrowserRedirect, we need to manually process the callback URL
            // The URL contains the access_token and refresh_token that Supabase needs
            try {
                // Parse the callback URL to extract the tokens
                const callbackUrl = result.url;
                console.log('OAuth callback URL:', callbackUrl);
                
                // On native with skipBrowserRedirect, Supabase doesn't automatically process the callback URL
                // We need to manually extract tokens from the URL hash and set the session
                const hashStart = callbackUrl.indexOf('#');
                if (hashStart === -1) {
                    console.warn('No hash fragment in OAuth callback URL');
                    Alert.alert('Error', 'Invalid OAuth callback URL');
                    return;
                }
                
                const hash = callbackUrl.substring(hashStart + 1);
                const params = new URLSearchParams(hash);
                
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                
                if (!accessToken || !refreshToken) {
                    console.warn('Missing tokens in OAuth callback URL', { accessToken: !!accessToken, refreshToken: !!refreshToken });
                    Alert.alert('Error', 'Invalid OAuth callback. Missing authentication tokens.');
                    return;
                }
                
                // Manually set the session using the tokens from the URL
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                
                if (sessionError) {
                    console.error('Error setting session from OAuth callback:', sessionError);
                    Alert.alert('Error', `Failed to create session: ${sessionError.message}`);
                    return;
                }
                
                if (sessionData?.session && sessionData.user) {
                    console.log('OAuth authentication successful - session created');
                    
                    // Check if this is a new user (first time OAuth sign-in)
                    // For new users, we'll default to 'user' role, but they can change it later
                    // For existing users, keep their existing role
                    const { data: existingProfile } = await supabase
                      .from('profiles')
                      .select('role')
                      .eq('id', sessionData.user.id)
                      .single();

                    // If no profile exists or role is not set, default to 'user'
                    if (!existingProfile || !existingProfile.role) {
                      await supabase
                        .from('profiles')
                        .update({ role: 'user' })
                        .eq('id', sessionData.user.id);
                    }

                    // Fetch updated profile to get the correct role
                    const { data: updatedProfile } = await supabase
                      .from('profiles')
                      .select('role')
                      .eq('id', sessionData.user.id)
                      .single();

                    // Refresh profile in auth context to ensure it's up to date
                    await refetchProfile();

                    // Redirect based on role after OAuth success
                    // Small delay to ensure session is fully set and profile is refreshed
                    setTimeout(() => {
                      if (updatedProfile?.role === 'owner' || updatedProfile?.role === 'admin') {
                        router.replace('/admin');
                      } else {
                        router.replace('/map');
                      }
                    }, 200);
                } else {
                    console.warn('No session data returned after setSession');
                    Alert.alert('Error', 'Failed to create session. Please try again.');
                }
            } catch (error) {
                console.error('Error processing OAuth callback:', error);
                Alert.alert('Error', 'Failed to complete authentication. Please try again.');
            }
        } else if (result.type === 'cancel') {
          // User cancelled, do nothing
        } else {
          Alert.alert('Error', 'Authentication failed');
        }
      } else if (!isNative && data.url) {
        // On web, Supabase handles the redirect automatically
        // Navigate to the OAuth URL if window is available (not during static export)
        if (typeof window !== 'undefined') {
          window.location.href = data.url;
        } else {
          Alert.alert('Error', 'OAuth is not available in this environment. Please use a browser.');
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
      <Text style={styles.subtitle}>{isSignUp ? 'Sign up to continue' : 'Sign in to continue'}</Text>

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
            placeholder="Your Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={(text) => {
                setEmail(text);
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
            <View style={[
                styles.passwordContainer,
                passwordError && styles.inputError,
                isRateLimited && styles.inputDisabled
            ]}>
                <TextInput
                style={styles.passwordInput}
                placeholder="Your Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={(text) => {
                    setPassword(text);
                    // Clear error when user starts typing
                    if (passwordError) setPasswordError('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!isRateLimited}
                />
                <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isRateLimited}
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    accessibilityHint="Toggles password visibility"
                >
                    <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color="#999"
                    />
                </TouchableOpacity>
            </View>
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
          accessibilityLabel={isSignUp ? "Sign Up" : "Sign In"}
          accessibilityHint={isSignUp ? "Creates a new account with your email and password" : "Signs in to your existing account"}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>

        {!isSignUp && (
          <TouchableOpacity 
            onPress={() => router.push('/reset-password')}
            style={styles.forgotPasswordButton}
            accessibilityLabel="Forgot Password"
            accessibilityHint="Opens the password reset page to recover your account"
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        )}

        {/* Role selection for sign-up */}
        {isSignUp && showRoleSelection && (
          <View style={styles.roleSelectionContainer}>
            <Text style={styles.roleSelectionTitle}>I am a...</Text>
            <View style={styles.roleButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedRole === 'user' && styles.roleButtonSelected
                ]}
                onPress={() => setSelectedRole('user')}
              >
                <Ionicons 
                  name="person" 
                  size={24} 
                  color={selectedRole === 'user' ? '#fff' : '#666'} 
                />
                <Text style={[
                  styles.roleButtonText,
                  selectedRole === 'user' && styles.roleButtonTextSelected
                ]}>
                  Customer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedRole === 'owner' && styles.roleButtonSelected
                ]}
                onPress={() => setSelectedRole('owner')}
              >
                <Ionicons 
                  name="restaurant" 
                  size={24} 
                  color={selectedRole === 'owner' ? '#fff' : '#666'} 
                />
                <Text style={[
                  styles.roleButtonText,
                  selectedRole === 'owner' && styles.roleButtonTextSelected
                ]}>
                  Restaurant Owner
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowRoleSelection(false)}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity 
          onPress={() => {
            setIsSignUp(!isSignUp);
            setShowRoleSelection(false);
            setSelectedRole('user');
          }}
          style={styles.toggleButton}
          accessibilityLabel={isSignUp ? "Switch to Sign In" : "Switch to Sign Up"}
          accessibilityHint={isSignUp ? "Switches to the sign in form for existing users" : "Switches to the sign up form to create a new account"}
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

      <View style={styles.socialButtonsContainer}>
        <TouchableOpacity 
          style={[styles.socialButton, styles.googleButton]} 
          onPress={handleGoogleSignIn}
          accessibilityLabel="Sign in with Google"
          accessibilityHint="Opens Google sign in in your browser"
        >
          <Image 
            source={require('@/assets/images/google-logo.png')} 
            style={styles.googleLogo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Google logo"
          />
          <Text style={styles.socialButtonText}>Google</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.socialButton, styles.appleButton]} 
          disabled={true}
          accessibilityLabel="Sign in with Apple is not currently available"
          accessibilityHint="Apple sign in is not currently available"
        >
          <View style={styles.appleIconContainer}>
            <FontAwesome5 name="apple" size={20} color="#000" />
          </View>
          <Text style={styles.socialButtonText}>Apple</Text>
        </TouchableOpacity>
      </View>
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
    fontWeight: 'bold',
    marginTop: 99,
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Manrope',
    fontWeight: '400',
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
    borderRadius: 16,
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
  socialButtonsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#E9EAEB',
    marginRight: 6,
  },
  appleButton: {
    backgroundColor: '#E9EAEB',
    marginRight: 0,
    marginLeft: 6,
  },
  googleButton: {
    backgroundColor: '#E9EAEB',
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  appleIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordButton: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  forgotPasswordText: {
    color: '#FE902A',
    fontSize: 14,
    fontWeight: '500',
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    margin: 0,
  },
  eyeIcon: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleSelectionContainer: {
    width: '100%',
    marginTop: 20,
    marginBottom: 12,
  },
  roleSelectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  roleButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  roleButtonSelected: {
    borderColor: '#FE902A',
    backgroundColor: '#FE902A',
  },
  roleButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  roleButtonTextSelected: {
    color: '#fff',
  },
  backButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#FE902A',
    fontSize: 14,
    fontWeight: '500',
  },
});