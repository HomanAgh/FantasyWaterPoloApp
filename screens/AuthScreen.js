import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  ImageBackground,
} from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';
import { useAuth } from '../context/AuthContext';

// Drop Figma exports into assets/images/, then set these requires:
//   auth-bg.png    — full-bleed water/player background
//   auth-title.png — logo + "FANTASY WATER POLO" + yellow ribbon (transparent PNG)
const AUTH_BG = null; // require('../assets/images/auth-bg.png')
const AUTH_TITLE = null; // require('../assets/images/auth-title.png')

const AuthScreen = ({ onNewUser }) => {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const switchMode = (newMode) => {
    // Keep email when entering/leaving forgot so users don't retype it
    if (newMode === 'forgot' || mode === 'forgot') {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setMode(newMode);
      return;
    }
    resetForm();
    setMode(newMode);
  };

  const validateEmail = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return false;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const validateInputs = () => {
    if (!validateEmail()) return false;
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return false;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;
    setIsLoading(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          Alert.alert('Login Failed', 'Incorrect email or password.');
        } else if (error.message.includes('Email not confirmed')) {
          Alert.alert('Email Not Confirmed', 'Please check your inbox and confirm your email before logging in.');
        } else {
          Alert.alert('Login Failed', error.message);
        }
      }
      // On success, AuthContext updates session → App.js handles navigation
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!validateInputs()) return;
    setIsLoading(true);
    try {
      const { data, error } = await signUp(email.trim(), password);
      if (error) {
        if (error.message.includes('already registered')) {
          Alert.alert('Account Exists', 'An account with this email already exists. Try logging in instead.');
        } else {
          Alert.alert('Sign Up Failed', error.message);
        }
        return;
      }
      // If email confirmation is disabled in Supabase, the session is set immediately
      // and onNewUser will be called by App.js. If confirmation is enabled, tell them.
      if (data?.user && !data?.session) {
        Alert.alert(
          'Check Your Email',
          'We sent you a confirmation link. Click it to activate your account, then come back and log in.'
        );
        switchMode('login');
      } else {
        // Session is live — App.js will detect new user and call onNewUser via AppContent
        onNewUser?.();
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!validateEmail()) return;
    setIsLoading(true);
    try {
      const { error } = await resetPassword(email.trim());
      if (error) {
        Alert.alert('Reset Failed', error.message);
        return;
      }
      Alert.alert(
        'Check Your Email',
        'If an account exists for that email, we sent a password reset link. Open it in your browser, set a new password, then come back and sign in.'
      );
      switchMode('login');
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const primaryAction =
    mode === 'login' ? handleLogin : mode === 'signup' ? handleSignUp : handleForgotPassword;

  const primaryLabel =
    mode === 'login' ? 'SIGN IN' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SEND RESET LINK';

  const renderHero = () => {
    if (AUTH_TITLE) {
      return (
        <Image source={AUTH_TITLE} style={styles.titleImage} resizeMode="contain" />
      );
    }

    // Temporary fallback until Figma title PNG is dropped in
    return (
      <View style={styles.heroFallback}>
        <Text style={styles.welcomeChip}>WELCOME TO</Text>
        <Text style={styles.appTitle}>FANTASY{'\n'}WATER POLO</Text>
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>DIVE INTO ACTION</Text>
        </View>
      </View>
    );
  };

  const content = (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>{renderHero()}</View>

        {mode !== 'forgot' && (
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => switchMode('login')}
              disabled={isLoading}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                LOG IN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => switchMode('signup')}
              disabled={isLoading}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                CREATE ACCOUNT
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          {mode === 'forgot' && (
            <Text style={styles.helperText}>
              Enter your account email. Open the link in your browser to set a new password, then return here to sign in.
            </Text>
          )}

          <Text style={styles.fieldLabel}>Email</Text>
          <View style={styles.inputRow}>
            <Image source={Icons.letter} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.auth.placeholder}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!isLoading}
            />
          </View>

          {mode !== 'forgot' && (
            <>
              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Password</Text>
              <View style={styles.inputRow}>
                <Image source={Icons.locked} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.auth.placeholder}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={isLoading}
                >
                  <Image
                    source={Icons.eye}
                    style={[styles.eyeIcon, showPassword && styles.eyeIconActive]}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {mode === 'login' && (
            <TouchableOpacity
              onPress={() => switchMode('forgot')}
              disabled={isLoading}
              style={styles.forgotLink}
            >
              <Text style={styles.forgotLinkText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {mode === 'signup' && (
            <>
              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Confirm Password</Text>
              <View style={styles.inputRow}>
                <Image source={Icons.locked} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  placeholderTextColor={colors.auth.placeholder}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="new-password"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={isLoading}
                >
                  <Image
                    source={Icons.eye}
                    style={[styles.eyeIcon, showConfirmPassword && styles.eyeIconActive]}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={primaryAction}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{primaryLabel}</Text>
          )}
        </TouchableOpacity>

        {mode === 'forgot' && (
          <TouchableOpacity
            onPress={() => switchMode('login')}
            disabled={isLoading}
            style={styles.switchLink}
          >
            <Text style={styles.switchLinkText}>Back to Sign In</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (AUTH_BG) {
    return (
      <ImageBackground source={AUTH_BG} style={styles.container} resizeMode="cover">
        <View style={styles.scrim}>{content}</View>
      </ImageBackground>
    );
  }

  return <View style={[styles.container, styles.fallbackBg]}>{content}</View>;
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  fallbackBg: {
    backgroundColor: colors.auth.background,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(2, 11, 24, 0.35)',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  hero: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  titleImage: {
    width: '100%',
    height: 180,
  },
  heroFallback: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  welcomeChip: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.white,
    backgroundColor: colors.auth.buttonBottom,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  appTitle: {
    fontSize: 34,
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.white,
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: 1,
    textShadowColor: colors.auth.neon,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  ribbon: {
    marginTop: spacing.sm,
    backgroundColor: colors.sand,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    transform: [{ rotate: '-2deg' }],
  },
  ribbonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.oceanDeep,
  },
  tabs: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: borderRadius.round,
    borderWidth: 1.5,
    borderColor: colors.auth.neon,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: colors.oceanDeep,
  },
  tabText: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 16,
    letterSpacing: 0.5,
    color: colors.white,
  },
  tabTextActive: {
    color: colors.white,
  },
  card: {
    width: '100%',
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.auth.neon,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  fieldLabelSpaced: {
    marginTop: spacing.md,
  },
  helperText: {
    fontSize: 14,
    color: colors.auth.placeholder,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.auth.inputBg,
    borderRadius: borderRadius.medium,
    borderWidth: 1.5,
    borderColor: colors.auth.neon,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputIcon: {
    width: 18,
    height: 18,
    marginRight: spacing.sm,
    resizeMode: 'contain',
    tintColor: colors.auth.neon,
  },
  input: {
    flex: 1,
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.white,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  eyeIcon: {
    width: 20,
    height: 20,
    marginLeft: spacing.sm,
    resizeMode: 'contain',
    tintColor: colors.white,
    opacity: 0.7,
  },
  eyeIconActive: {
    opacity: 1,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  forgotLinkText: {
    color: colors.auth.neon,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    width: '100%',
    backgroundColor: colors.auth.buttonTop,
    borderRadius: borderRadius.round,
    paddingVertical: spacing.md + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    color: colors.white,
    fontSize: 24,
    letterSpacing: 1,
  },
  switchLink: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  switchLinkText: {
    color: colors.auth.neon,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default AuthScreen;
