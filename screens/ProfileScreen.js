import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { teamName } = useTeam();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const email = session?.user?.email ?? '—';

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              const { error } = await signOut();
              if (error) {
                Alert.alert('Log Out Failed', error.message);
              }
              // On success, AuthContext clears session → App.js shows AuthScreen
            } catch (err) {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image source={Icons.badge} style={styles.headerEmoji} />
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Your account</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Email</Text>
        <Text style={styles.fieldValue} selectable>
          {email}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.fieldLabel}>Team name</Text>
        <Text style={styles.fieldValue}>{teamName || 'My Team'}</Text>
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
        onPress={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.logoutButtonText}>Log Out</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    backgroundColor: colors.oceanDeep,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.large,
    borderBottomRightRadius: borderRadius.large,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerEmoji: {
    width: 40,
    height: 40,
    marginBottom: spacing.sm,
    resizeMode: 'contain',
    tintColor: colors.sand,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.seafoam,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.pearl,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    ...shadows.medium,
    borderWidth: 2,
    borderColor: colors.oceanBright + '30',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  fieldValue: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.oceanDeep,
  },
  divider: {
    height: 1,
    backgroundColor: colors.oceanBright + '40',
    marginVertical: spacing.md,
  },
  logoutButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.coral,
    borderRadius: borderRadius.large,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.large,
    borderWidth: 3,
    borderColor: colors.oceanDeep,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: 'bold',
  },
});
