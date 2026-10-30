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
import { colors, borderRadius, spacing, fonts, layout } from '../styles/theme';
import * as userProfileService from '../services/userProfileService';

// Same Figma title export as AuthScreen — drop into assets/images/ then set:
const AUTH_TITLE = null; // require('../assets/images/auth-title.png')

/**
 * Onboarding screen for new users to set their team name
 * @param {Object} props
 * @param {string} props.userId - User ID
 * @param {Function} props.onComplete - Callback when onboarding is complete
 */
const OnboardingScreen = ({ userId, onComplete }) => {
  const [teamName, setTeamName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateTeamName = (name) => {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      return { isValid: false, error: 'Please enter a team name' };
    }

    if (trimmed.length < 3) {
      return { isValid: false, error: 'Team name must be at least 3 characters' };
    }

    if (trimmed.length > 30) {
      return { isValid: false, error: 'Team name must be less than 30 characters' };
    }

    const validPattern = /^[a-zA-Z0-9\s\-_'!]+$/;
    if (!validPattern.test(trimmed)) {
      return { isValid: false, error: 'Team name contains invalid characters' };
    }

    return { isValid: true, error: '' };
  };

  const handleCreateTeam = async () => {
    const validation = validateTeamName(teamName);

    if (!validation.isValid) {
      Alert.alert('Invalid Team Name', validation.error);
      return;
    }

    try {
      setIsLoading(true);
      console.log('[OnboardingScreen] Creating profile for userId:', userId, 'teamName:', teamName.trim());

      const { data, error } = await userProfileService.createUserProfile(
        userId,
        teamName.trim()
      );

      if (error) {
        console.error('[OnboardingScreen] Error from createUserProfile:', error);
        throw error;
      }

      console.log('[OnboardingScreen] Profile created successfully:', data);
      onComplete(teamName.trim());
    } catch (error) {
      console.error('[OnboardingScreen] Error creating profile:', error);
      Alert.alert('Error', 'Failed to create your team. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderHero = () => {
    if (AUTH_TITLE) {
      return (
        <Image source={AUTH_TITLE} style={styles.titleImage} resizeMode="contain" />
      );
    }

    return (
      <View style={styles.heroFallback}>
        <Text style={styles.welcomeChip}>WELCOME TO</Text>
        <Text style={styles.appTitle}>FANTASY{'\n'}WATER POLO</Text>
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>DIVE INTO THE ACTION</Text>
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

        <View style={styles.card}>
          <Text style={styles.label}>What's your team name?</Text>
          <TextInput
            style={styles.input}
            value={teamName}
            onChangeText={setTeamName}
            placeholder="Enter your team name"
            placeholderTextColor={colors.auth.placeholder}
            maxLength={30}
            autoFocus
            editable={!isLoading}
          />
          <Text style={styles.hint}>3-30 characters. Letters, numbers & spaces.</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleCreateTeam}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>CREATE MY TEAM</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return <View style={styles.container}>{content}</View>;
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    width: '100%',
    maxWidth: layout.formMaxWidth,
    alignSelf: 'center',
  },
  hero: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  titleImage: {
    width: '100%',
    maxWidth: layout.formMaxWidth,
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
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 34,
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
  card: {
    width: '100%',
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.auth.neon,
  },
  label: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 20,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.auth.inputBg,
    borderRadius: borderRadius.medium,
    borderWidth: 1.5,
    borderColor: colors.auth.neon,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.white,
    textAlign: 'center',
  },
  hint: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 14,
    color: colors.auth.placeholder,
    textAlign: 'center',
    marginTop: spacing.sm,
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
});

export default OnboardingScreen;
