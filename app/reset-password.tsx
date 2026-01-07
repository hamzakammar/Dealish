import { getAuthRedirectUrl, supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Redirect, useRouter } from 'expo-router';
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

const validateEmail = (email: string) => {
    return validator.isEmail(email);
};

export default function ResetPasswordScreen() {
    const { session, isLoading } = useAuthContext();
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

    // If already logged in, redirect to map
    if (session && !hasRecoveryToken) {
        return <Redirect href="/map" />;
    }

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
            const redirectUrl = getAuthRedirectUrl();
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${redirectUrl}?type=recovery`,
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
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#FE902A" />
            </View>
        );
    }

    // Show email input form if no recovery token
    if (!hasRecoveryToken) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subtitle}>
                    Enter your email address and we'll send you a link to reset your password
                </Text>

                <View style={styles.form}>
                    {emailSent ? (
                        <View style={styles.successContainer}>
                            <Text style={styles.successText}>
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
                                        styles.input,
                                        emailError && styles.inputError,
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
                        <Text style={styles.backText}>Back to Sign In</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Show password reset form if recovery token exists
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>
                Enter your new password below
            </Text>

            <View style={styles.form}>
                <View>
                    <View style={[
                        styles.passwordContainer,
                        passwordError && styles.inputError,
                    ]}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="New Password"
                            placeholderTextColor="#999"
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
                                color="#999"
                            />
                        </TouchableOpacity>
                    </View>
                    {passwordError && (
                        <Text style={styles.errorText}>{passwordError}</Text>
                    )}
                </View>

                <View>
                    <View style={[
                        styles.passwordContainer,
                        confirmPasswordError && styles.inputError,
                    ]}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="Confirm New Password"
                            placeholderTextColor="#999"
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
                                color="#999"
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
    backText: {
        color: '#666',
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
    successText: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
    },
});

