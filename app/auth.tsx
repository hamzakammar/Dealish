import { getAuthRedirectUrl, supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { checkRateLimit, clearRateLimit, formatRemainingTime, recordFailedAttempt } from '@/utils/rateLimit';
import { useThemeColors } from '@/hooks/useThemeColors';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const colors = useThemeColors();
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
  const redirectingRef = useRef(false);
  
  // Dynamic styles based on theme
  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 32,
      fontFamily: 'Manrope',
      fontWeight: 'bold',
      marginTop: 99,
      marginBottom: 8,
      textAlign: 'center',
      color: colors.text,
    },
    subtitle: {
      fontSize: 16,
      fontFamily: 'Manrope',
      fontWeight: '400',
      color: colors.textSecondary,
      marginBottom: 40,
      textAlign: 'center',
    },
    input: {
      width: '100%',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      marginBottom: 12,
      fontSize: 16,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      marginBottom: 12,
      backgroundColor: colors.inputBackground,
    },
    passwordInput: {
      flex: 1,
      fontSize: 16,
      padding: 0,
      margin: 0,
      color: colors.text,
    },
    socialButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: colors.cardSecondary,
      marginRight: 6,
    },
    socialButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    toggleText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    forgotPasswordText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '500',
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      marginHorizontal: 16,
      color: colors.textTertiary,
      fontSize: 14,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      marginTop: -8,
      marginBottom: 8,
      marginLeft: 4,
    },
    rateLimitText: {
      color: colors.isDark ? '#ffc107' : '#856404',
      fontSize: 14,
      textAlign: 'center',
    },
    roleSelectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
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
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    roleButtonText: {
      marginTop: 8,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
  }), [colors]);

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

  // When user has session on auth page (e.g. just logged in), redirect to app
  // index.tsx handles initial load; this handles post-login redirect when user is ON auth page
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (!isLoading && session && !redirectingRef.current) {
      redirectingRef.current = true;
      const checkAndSetRole = async () => {
        try {
          const preferredRole = session.user.user_metadata?.preferred_role;
          if (preferredRole && (preferredRole === 'user' || preferredRole === 'owner')) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
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
      // Redirect to index so it can route to admin/onboarding/map (single source of truth)
      timeoutId = setTimeout(() => {
        router.replace('/');
      }, 0);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [session, isLoading, router]);

  // NOW we can do conditional returns - but show loading instead of null to keep component mounted
  // Show loading state or if already logged in (during redirect)
  if (isLoading) {
    return (
      <View style={dynamicStyles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // If we have a session, show loading while redirecting (don't return null to keep hooks consistent)
  if (session) {
    return (
      <View style={dynamicStyles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  const handleEmailAuth = async () => {
    // Prevent double-submit while processing
    if (loading) return;

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
  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
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
        provider: provider,
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
                if (__DEV__) {
                  console.log('OAuth callback URL:', callbackUrl);
                }
                
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
                    if (__DEV__) {
                      console.log('OAuth authentication successful - session created');
                    }
                    
                    // Check if this is a new user (first time OAuth sign-in)
                    // For new users, we'll default to 'user' role, but they can change it later
                    // For existing users, keep their existing role
                    const { data: existingProfile, error: profileFetchError } = await supabase
                      .from('profiles')
                      .select('role')
                      .eq('id', sessionData.user.id)
                      .maybeSingle();

                    // If no profile exists or role is not set, default to 'user'
                    // Use upsert to handle both new and existing profiles safely
                    if (profileFetchError || !existingProfile || !existingProfile.role) {
                      await supabase
                        .from('profiles')
                        .upsert({ id: sessionData.user.id, role: 'user' }, { onConflict: 'id' });
                    }

                    // Refresh profile in auth context to ensure it's up to date
                    // This will update the profile state, then index.tsx will handle routing
                    await refetchProfile();

                    // Redirect immediately - index.tsx will handle proper routing based on profile
                    router.replace('/map');
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
        let errorMessage = `Failed to sign in with ${provider === 'apple' ? 'Apple' : 'Google'}`;
        if (error instanceof Error && error.message) {
          errorMessage = error.message;
        } else if (typeof error === 'string' && error) {
          errorMessage = error;
        }
        Alert.alert('Error', errorMessage);
    }
  };


  return (
    <View style={dynamicStyles.container}>
      <Text style={dynamicStyles.title}>Take advantage of this deal</Text>
      <Text style={dynamicStyles.subtitle}>{isSignUp ? 'Sign up to continue' : 'Sign in to continue'}</Text>

      <View style={styles.form}>
        {rateLimitError && (
          <View style={[styles.rateLimitContainer, { backgroundColor: colors.isDark ? '#332701' : '#fff3cd', borderColor: colors.isDark ? '#664d03' : '#ffc107' }]}>
            <Text style={dynamicStyles.rateLimitText}>{rateLimitError}</Text>
          </View>
        )}

        <View>
            <TextInput
            style={[
                dynamicStyles.input,
                emailError && styles.inputError,
                isRateLimited && styles.inputDisabled
            ]}
            placeholder="Your Email"
            placeholderTextColor={colors.textTertiary}
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
            <Text style={dynamicStyles.errorText}>{emailError}</Text>
            )}
        </View>

        <View>
            <View style={[
                dynamicStyles.passwordContainer,
                passwordError && styles.inputError,
                isRateLimited && styles.inputDisabled
            ]}>
                <TextInput
                style={dynamicStyles.passwordInput}
                placeholder="Your Password"
                placeholderTextColor={colors.textTertiary}
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
                        color={colors.textTertiary}
                    />
                </TouchableOpacity>
            </View>
            {passwordError && (
            <Text style={dynamicStyles.errorText}>{passwordError}</Text>
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

        {/* Role selection removed - restaurant accounts are invite only */}

        {!isSignUp && (
          <TouchableOpacity 
            onPress={() => router.push('/reset-password')}
            style={styles.forgotPasswordButton}
            accessibilityLabel="Forgot Password"
            accessibilityHint="Opens the password reset page to recover your account"
          >
            <Text style={dynamicStyles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          onPress={() => {
            setIsSignUp(!isSignUp);
            setSelectedRole('user');
          }}
          style={styles.toggleButton}
          accessibilityLabel={isSignUp ? "Switch to Sign In" : "Switch to Sign Up"}
          accessibilityHint={isSignUp ? "Switches to the sign in form for existing users" : "Switches to the sign up form to create a new account"}
        >
          <Text style={dynamicStyles.toggleText}>
            {isSignUp 
              ? 'Already have an account? Sign in' 
              : "Don't have an account? Sign up"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider}>
        <View style={dynamicStyles.dividerLine} />
        <Text style={dynamicStyles.dividerText}>OR</Text>
        <View style={dynamicStyles.dividerLine} />
      </View>

      <View style={styles.socialButtonsContainer}>
        <TouchableOpacity 
          style={[dynamicStyles.socialButton, styles.googleButton]} 
          onPress={() => handleOAuthSignIn('google')}
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
          <Text style={dynamicStyles.socialButtonText}>Google</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[dynamicStyles.socialButton, styles.appleButton]} 
          onPress={() => handleOAuthSignIn('apple')}
          accessibilityLabel="Sign in with Apple"
          accessibilityHint="Opens Apple sign in in your browser"
        >
          <View style={styles.appleIconContainer}>
            <FontAwesome5 name="apple" size={20} color={colors.text} />
          </View>
          <Text style={dynamicStyles.socialButtonText}>Apple</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  form: {
    width: '100%',
    marginBottom: 20,
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
    marginRight: 6,
  },
  appleButton: {
    marginRight: 0,
    marginLeft: 6,
  },
  googleButton: {
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  inputError: {
    borderColor: '#ff4444',
    borderWidth: 1,
  },
  rateLimitContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  eyeIcon: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleSelectionContainer: {
    width: '100%',
    marginTop: 12,
    marginBottom: 12,
  },
  roleButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  roleButtonSelected: {
    borderColor: '#FE902A',
    backgroundColor: '#FE902A',
  },
  roleButtonTextSelected: {
    color: '#fff',
  },
});