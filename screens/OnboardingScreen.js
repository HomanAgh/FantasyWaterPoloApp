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
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import * as userProfileService from '../services/userProfileService';

/**
 * Onboarding screen for new users to set their team name
 * @param {Object} props
 * @param {string} props.userId - User ID
 * @param {Function} props.onComplete - Callback when onboarding is complete
 */
const OnboardingScreen = ({ userId, onComplete }) => {
  const [teamName, setTeamName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Validate team name
   * @param {string} name - Team name to validate
   * @returns {Object} { isValid: boolean, error: string }
   */
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

    // Check for invalid characters (allow letters, numbers, spaces, and basic punctuation)
    const validPattern = /^[a-zA-Z0-9\s\-_'!]+$/;
    if (!validPattern.test(trimmed)) {
      return { isValid: false, error: 'Team name contains invalid characters' };
    }

    return { isValid: true, error: '' };
  };

  /**
   * Handle team creation
   */
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

      // Call onComplete callback to proceed to main app
      onComplete(teamName.trim());
    } catch (error) {
      console.error('[OnboardingScreen] Error creating profile:', error);
      Alert.alert('Error', 'Failed to create your team. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Ocean-themed background */}
      <View style={styles.backgroundWaves}>
        <Text style={styles.waveTop}>🌊</Text>
        <Text style={styles.waveBottom}>🌊</Text>
      </View>

      <View style={styles.content}>
        {/* Header with water polo theme */}
        <View style={styles.header}>
          <Text style={styles.iconLarge}>🏊‍♂️</Text>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.appTitle}>Fantasy Water Polo</Text>
          <Text style={styles.subtitle}>Dive into the action! 💧</Text>
        </View>

        {/* Input Card */}
        <View style={styles.inputCard}>
          <Text style={styles.label}>What's your team name?</Text>
          <TextInput
            style={styles.input}
            value={teamName}
            onChangeText={setTeamName}
            placeholder="Enter your team name..."
            placeholderTextColor={colors.textMuted}
            maxLength={30}
            autoFocus={true}
            editable={!isLoading}
          />
          <Text style={styles.hint}>3-30 characters • Letters, numbers & spaces</Text>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[
            styles.button,
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleCreateTeam}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.buttonText}>Create My Team</Text>
              <Text style={styles.buttonEmoji}>🎯</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  backgroundWaves: {
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
    fontSize: 150,
    opacity: 0.1,
    transform: [{ rotate: '45deg' }],
  },
  waveBottom: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    fontSize: 150,
    opacity: 0.1,
    transform: [{ rotate: '-45deg' }],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  iconLarge: {
    fontSize: 100,
    marginBottom: spacing.md,
  },
  welcomeText: {
    fontSize: 20,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.oceanDeep,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.oceanMedium,
    fontWeight: '600',
  },
  inputCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.medium,
    borderWidth: 2,
    borderColor: colors.oceanBright + '30',
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.oceanDeep,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 18,
    color: colors.textDark,
    borderWidth: 2,
    borderColor: colors.oceanMedium,
    textAlign: 'center',
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  button: {
    backgroundColor: colors.oceanMedium,
    borderRadius: borderRadius.large,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xxl,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...shadows.large,
    borderWidth: 3,
    borderColor: colors.oceanDeep,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: spacing.sm,
  },
  buttonEmoji: {
    fontSize: 20,
  },
});

export default OnboardingScreen;
