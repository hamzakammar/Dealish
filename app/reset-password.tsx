import { getAuthRedirectUrl, supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
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

const validateEmail = (email: string) => {
    return validator.isEmail(email);
};

export default function ResetPasswordScreen() {
    const { session, isLoading } = useAuthContext();
    const colors = useThemeColors();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [hasRecoveryToken, setHasRecoveryToken] = useState(false);

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
            color: colors.text,
        },
        backText: {
            color: colors.textSecondary,
            fontSize: 14,
        },
        successText: {
            color: colors.textSecondary,
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 24,
        },
    }), [colors]);

    // Check if we have a recovery token from deep link or URL params
    useEffect(() => {
        const checkRecoveryToken = async () => {
            try {
                // Check URL params first
                const url = await Linking.getInitialURL();
                if (url && (url.includes('#access_token=') || url.includes('type=recovery'))) {
                    setHasRecoveryToken(true);
                    return;
                }
            } catch (error) {
                console.error('Error checking recovery token:', error);
            }
        };

        checkRecoveryToken();

        // Listen for deep links
        const subscription = Linking.addEventListener('url', (event) => {
            const { url } = event;
            if (url && (url.includes('#access_token=') || url.includes('type=recovery'))) {
                setHasRecoveryToken(true);
                // Parse the token and set session
                supabase.auth.getSession();
            }
        });

        return () => subscription.remove();
    }, []);

    const handleSendResetEmail = async () => {
        setEmailError('');
        
        if (!email) {
            setEmailError('Email is required');
            return;
        }

        if (!validateEmail(email)) {
            setEmailError('Please enter a valid email address');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'dealish://auth/callback',
            });

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                setEmailSent(true);
                Alert.alert(
                    'Email Sent',
                    'Please check your email for password reset instructions.'
                );
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send reset email');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        setPasswordError('');
        setConfirmPasswordError('');

        if (!newPassword) {
            setPasswordError('Password is required');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setConfirmPasswordError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                Alert.alert(
                    'Success',
                    'Your password has been reset successfully.',
                    [
                        {
                            text: 'OK',
                            onPress: () => router.replace('/map'),
                        },
                    ]
                );
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    // Show loading state
    if (isLoading) {
        return (
            <View style={dynamicStyles.container}>
                <ActivityIndicator size="large" color="#FE902A" />
            </View>
        );
    }

    // If already logged in (and not doing a password recovery), redirect to map
    if (session && !hasRecoveryToken) {
        return <Redirect href="/map" />;
    }

    // Show email input form if no recovery token
    if (!hasRecoveryToken) {
        return (
            <View style={dynamicStyles.container}>
                <Text style={dynamicStyles.title}>Reset Password</Text>
                <Text style={dynamicStyles.subtitle}>
                    Enter your email address and we'll send you a link to reset your password
                </Text>

                <View style={styles.form}>
                    {emailSent ? (
                        <View style={styles.successContainer}>
                            <Text style={dynamicStyles.successText}>
                                If an account exists with this email, you'll receive password reset instructions.
                            </Text>
                            <TouchableOpacity
                                style={[styles.button, styles.emailButton]}
                                onPress={() => {
                                    setEmailSent(false);
                                    setEmail('');
                                }}
                                accessibilityLabel="Send Another Email"
                                accessibilityHint="Sends another password reset email to your address"
                            >
                                <Text style={styles.buttonText}>Send Another Email</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <View>
                                <TextInput
                                    style={[
                                        dynamicStyles.input,
                                        emailError && styles.inputError,
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
                                />
                                {emailError && (
                                    <Text style={styles.errorText}>{emailError}</Text>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    styles.emailButton,
                                    loading && styles.buttonDisabled,
                                ]}
                                onPress={handleSendResetEmail}
                                disabled={loading}
                                accessibilityLabel="Send Reset Email"
                                accessibilityHint="Sends a password reset link to your email address"
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>Send Reset Email</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}

                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        accessibilityLabel="Back to Sign In"
                        accessibilityHint="Returns to the sign in page"
                    >
                        <Text style={dynamicStyles.backText}>Back to Sign In</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Show password reset form if recovery token exists
    return (
        <View style={dynamicStyles.container}>
            <Text style={dynamicStyles.title}>Set New Password</Text>
            <Text style={dynamicStyles.subtitle}>
                Enter your new password below
            </Text>

            <View style={styles.form}>
                <View>
                    <View style={[
                        dynamicStyles.passwordContainer,
                        passwordError && styles.inputError,
                    ]}>
                        <TextInput
                            style={dynamicStyles.passwordInput}
                            placeholder="New Password"
                            placeholderTextColor={colors.textTertiary}
                            value={newPassword}
                            onChangeText={(text) => {
                                setNewPassword(text);
                                if (passwordError) setPasswordError('');
                            }}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoComplete="new-password"
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
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
                        <Text style={styles.errorText}>{passwordError}</Text>
                    )}
                </View>

                <View>
                    <View style={[
                        dynamicStyles.passwordContainer,
                        confirmPasswordError && styles.inputError,
                    ]}>
                        <TextInput
                            style={dynamicStyles.passwordInput}
                            placeholder="Confirm New Password"
                            placeholderTextColor={colors.textTertiary}
                            value={confirmPassword}
                            onChangeText={(text) => {
                                setConfirmPassword(text);
                                if (confirmPasswordError) setConfirmPasswordError('');
                            }}
                            secureTextEntry={!showConfirmPassword}
                            autoCapitalize="none"
                            autoComplete="new-password"
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            accessibilityLabel={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                            accessibilityHint="Toggles confirm password visibility"
                        >
                            <Ionicons
                                name={showConfirmPassword ? 'eye-off' : 'eye'}
                                size={20}
                                color={colors.textTertiary}
                            />
                        </TouchableOpacity>
                    </View>
                    {confirmPasswordError && (
                        <Text style={styles.errorText}>{confirmPasswordError}</Text>
                    )}
                </View>

                <TouchableOpacity
                    style={[
                        styles.button,
                        styles.emailButton,
                        loading && styles.buttonDisabled,
                    ]}
                    onPress={handleResetPassword}
                    disabled={loading}
                    accessibilityLabel="Reset Password"
                    accessibilityHint="Updates your account password with the new password you entered"
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Reset Password</Text>
                    )}
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
        borderRadius: 16,
        marginBottom: 12,
        alignItems: 'center',
    },
    emailButton: {
        backgroundColor: '#FE902A',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    backButton: {
        marginTop: 12,
        alignItems: 'center',
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
    eyeIcon: {
        position: 'absolute',
        right: 16,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    successContainer: {
        alignItems: 'center',
    },
});

