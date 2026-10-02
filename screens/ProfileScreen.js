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
  Linking,
} from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { LEGAL_URLS } from '../utils/legalUrls';

const LEGAL_LINKS = [
  { label: 'PRIVACY POLICY', url: LEGAL_URLS.privacy },
  { label: 'TERMS & CONDITIONS', url: LEGAL_URLS.terms },
  { label: 'HOW DELETE ACCOUNT WORKS', url: LEGAL_URLS.deleteAccount },
];

export default function ProfileScreen() {
  const { session, signOut, deleteAccount } = useAuth();
  const { teamName } = useTeam();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const email = session?.user?.email ?? '—';
  const busy = isLoggingOut || isDeleting;

  const openLegalUrl = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Unable to Open', 'Could not open the link. Please try again.');
    }
  };

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

  const performDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await deleteAccount();
      if (error) {
        Alert.alert(
          'Delete Failed',
          error.message || 'Could not delete your account. Please try again.'
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'This permanently deletes your team, points, league memberships, and login. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Delete',
              'Are you absolutely sure? Your Fantasy Water Polo account will be gone forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: performDelete,
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>PROFILE</Text>
      </View>

      {/* ── Account info ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>ACCOUNT</Text>
          <Image source={Icons.teambadge} style={[styles.cardHeaderIcon, styles.iconNeon]} />
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <Text style={styles.fieldValue} selectable numberOfLines={2}>
            {email}
          </Text>
        </View>

        <View style={styles.fieldDivider} />

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>TEAM NAME</Text>
          <Text style={styles.fieldValue}>{(teamName || 'My Team').toUpperCase()}</Text>
        </View>
      </View>

      {/* ── Legal ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>LEGAL</Text>
          <Image source={Icons.folder} style={[styles.cardHeaderIcon, styles.iconNeon]} />
        </View>

        {LEGAL_LINKS.map((item, index) => (
          <React.Fragment key={item.url}>
            {index > 0 && <View style={styles.fieldDivider} />}
            <TouchableOpacity
              style={styles.legalRow}
              onPress={() => openLegalUrl(item.url)}
              activeOpacity={0.7}
              disabled={busy}
            >
              <Text style={styles.legalLabel}>{item.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {/* ── Actions ── */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={[styles.outlineButton, busy && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={busy}
          activeOpacity={0.8}
        >
          {isLoggingOut ? (
            <ActivityIndicator color={colors.auth.neon} />
          ) : (
            <>
              <Image source={Icons.letter} style={[styles.outlineButtonIcon, styles.iconNeon]} />
              <Text style={styles.outlineButtonText}>LOG OUT</Text>
              <Text style={styles.chevron}>›</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteButton, busy && styles.buttonDisabled]}
          onPress={handleDeleteAccount}
          disabled={busy}
          activeOpacity={0.8}
        >
          {isDeleting ? (
            <ActivityIndicator color={colors.coral} />
          ) : (
            <Text style={styles.deleteButtonText}>DELETE ACCOUNT</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  header: {
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 64,
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.xl + 32,
  },

  iconNeon: {
    tintColor: colors.auth.neon,
  },

  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.auth.neon,
  },
  cardTitle: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 0.5,
  },
  cardHeaderIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },

  fieldRow: {
    paddingVertical: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 12,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    marginBottom: 4,
  },
  fieldValue: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.white,
    letterSpacing: 0.3,
  },
  fieldDivider: {
    height: 0.5,
    backgroundColor: colors.auth.neonSoft,
    marginVertical: spacing.xs,
  },

  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  legalLabel: {
    flex: 1,
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 0.5,
  },

  actionsCard: {
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    borderRadius: borderRadius.round,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.auth.glass,
    minHeight: 52,
    justifyContent: 'center',
  },
  outlineButtonIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    marginRight: spacing.sm,
  },
  outlineButtonText: {
    flex: 1,
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 22,
    color: colors.white,
    letterSpacing: 0.5,
  },
  chevron: {
    fontSize: 28,
    color: colors.auth.neon,
    fontWeight: '300',
    lineHeight: 28,
    marginTop: -2,
  },

  deleteButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 0.5,
    borderColor: colors.coral,
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 16,
    color: colors.coral,
    letterSpacing: 1,
  },
});
