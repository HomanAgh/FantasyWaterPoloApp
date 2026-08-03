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
} from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { useAuth } from '../context/AuthContext';

const AuthScreen = ({ onNewUser }) => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const switchMode = (newMode) => {
    resetForm();
    setMode(newMode);
  };

  const validateInputs = () => {
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
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Decorative background waves */}
      <View style={styles.bgWaves}>
        <Image source={Icons.wave} style={styles.waveTop} />
        <Image source={Icons.wave} style={styles.waveBottom} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={Icons.player} style={styles.icon} />
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.appTitle}>Fantasy Water Polo</Text>
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitle}>Dive into the action!</Text>
            <Image source={Icons.water} style={styles.subtitleIcon} />
          </View>
        </View>

        {/* Mode tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.tabActive]}
            onPress={() => switchMode('login')}
            disabled={isLoading}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'signup' && styles.tabActive]}
            onPress={() => switchMode('signup')}
            disabled={isLoading}
          >
            <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!isLoading}
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            editable={!isLoading}
          />

          {mode === 'signup' && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoComplete="new-password"
                editable={!isLoading}
              />
            </>
          )}
        </View>

        {/* Primary action button */}
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={mode === 'login' ? handleLogin : handleSignUp}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Switch mode link */}
        <TouchableOpacity
          onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          disabled={isLoading}
          style={styles.switchLink}
        >
          <Text style={styles.switchLinkText}>
            {mode === 'login'
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  bgWaves: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  waveTop: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 150,
    height: 150,
    opacity: 0.1,
    resizeMode: 'contain',
    transform: [{ rotate: '45deg' }],
  },
  waveBottom: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 150,
    height: 150,
    opacity: 0.1,
    resizeMode: 'contain',
    transform: [{ rotate: '-45deg' }],
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    width: 80,
    height: 80,
    marginBottom: spacing.sm,
    resizeMode: 'contain',
  },
  welcomeText: {
    fontSize: 18,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.oceanDeep,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.oceanMedium,
    fontWeight: '600',
  },
  subtitleIcon: {
    width: 15,
    height: 15,
    resizeMode: 'contain',
  },
  tabs: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.pearl,
    borderRadius: borderRadius.large,
    padding: 4,
    marginBottom: spacing.lg,
    ...shadows.small,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: borderRadius.medium,
  },
  tabActive: {
    backgroundColor: colors.oceanMedium,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.white,
  },
  card: {
    width: '100%',
    backgroundColor: colors.pearl,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.medium,
    borderWidth: 2,
    borderColor: colors.oceanBright + '30',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.oceanDeep,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 2,
    borderColor: colors.oceanMedium,
  },
  button: {
    width: '100%',
    backgroundColor: colors.oceanMedium,
    borderRadius: borderRadius.large,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.large,
    borderWidth: 3,
    borderColor: colors.oceanDeep,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: 'bold',
  },
  switchLink: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  switchLinkText: {
    color: colors.oceanMedium,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default AuthScreen;
