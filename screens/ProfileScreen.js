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
import { colors, borderRadius, spacing, fonts, layout } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { LEGAL_URLS } from '../utils/legalUrls';
import {
  isUsingTestAds,
  resetAdsStartCache,
  showRewardedAd,
  startAdsIfAllowed,
} from '../services/adsService';
import {
  openPrivacyOptionsForm,
  resetConsentGatherCache,
  resetUmpConsentForDev,
} from '../services/adsConsentService';

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
  const [isShowingAd, setIsShowingAd] = useState(false);
  const [isPrivacyBusy, setIsPrivacyBusy] = useState(false);
  const [isResettingUmp, setIsResettingUmp] = useState(false);

  const email = session?.user?.email ?? '—';
  const busy =
    isLoggingOut || isDeleting || isShowingAd || isPrivacyBusy || isResettingUmp;

  const openLegalUrl = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Unable to Open', 'Could not open the link. Please try again.');
    }
  };

  const handleTestRewardedAd = async () => {
    setIsShowingAd(true);
    try {
      const result = await showRewardedAd();
      if (result.error) {
        Alert.alert('Ad Error', result.error);
        return;
      }
      if (result.rewarded) {
        Alert.alert(
          'Reward Earned (test)',
          `type=${result.reward?.type ?? '—'}, amount=${result.reward?.amount ?? '—'}\n\nNo in-game reward is granted yet — this only verifies AdMob.`
        );
      } else {
        Alert.alert('Ad Closed', 'No reward earned (ad closed early or incomplete).');
      }
    } catch (err) {
      Alert.alert('Ad Error', err?.message || 'Something went wrong showing the ad.');
    } finally {
      setIsShowingAd(false);
    }
  };

  const handlePrivacyChoices = async () => {
    setIsPrivacyBusy(true);
    try {
      const result = await openPrivacyOptionsForm();
      if (result.error === 'not_required') {
        Alert.alert(
          'Privacy Choices',
          'No additional privacy options are required for your region right now.'
        );
        return;
      }
      if (!result.ok) {
        Alert.alert(
          'Privacy Choices',
          result.error || 'Could not open privacy options. Please try again.'
        );
        return;
      }
      // User may have changed consent — allow ads startup to run again.
      resetConsentGatherCache();
      resetAdsStartCache();
      await startAdsIfAllowed({ preload: true });
      Alert.alert(
        'Privacy Choices Updated',
        result.canRequestAds
          ? 'Your choices were saved. Ads may be available again.'
          : 'Your choices were saved. Ads may stay unavailable until you allow them.'
      );
    } catch (err) {
      Alert.alert(
        'Privacy Choices',
        err?.message || 'Could not open privacy options. Please try again.'
      );
    } finally {
      setIsPrivacyBusy(false);
    }
  };

  const handleResetUmpForDev = () => {
    Alert.alert(
      'Reset UMP Consent?',
      'Clears stored UMP consent on this device (dev only). Force-close and reopen the app afterward to see the US privacy form again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsResettingUmp(true);
            try {
              const result = resetUmpConsentForDev();
              resetAdsStartCache();
              if (!result.ok) {
                Alert.alert('Reset Failed', result.error || 'Could not reset UMP.');
                return;
              }
              Alert.alert(
                'UMP Reset',
                  'Consent cleared. Force-close the app, then reopen to gather consent again (debug geography = EEA).'
              );
            } finally {
              setIsResettingUmp(false);
            }
          },
        },
      ]
    );
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

        <View style={styles.fieldDivider} />
        <TouchableOpacity
          style={styles.legalRow}
          onPress={handlePrivacyChoices}
          activeOpacity={0.7}
          disabled={busy}
        >
          {isPrivacyBusy ? (
            <ActivityIndicator color={colors.auth.neon} />
          ) : (
            <>
              <Text style={styles.legalLabel}>PRIVACY CHOICES</Text>
              <Text style={styles.chevron}>›</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Dev-only AdMob smoke test (Google demo units — safe to click) ── */}
      {__DEV__ && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>ADS (DEV)</Text>
            <Image source={Icons.eye} style={[styles.cardHeaderIcon, styles.iconNeon]} />
          </View>
          <Text style={styles.devAdHint}>
            Uses Google sample rewarded ads
            {isUsingTestAds() ? ' (test mode)' : ''}. Safe to watch/click. No live AdMob traffic.
            {'\n'}UMP debug geography: EEA (__DEV__ only).
          </Text>
          <TouchableOpacity
            style={[styles.outlineButton, busy && styles.buttonDisabled]}
            onPress={handleTestRewardedAd}
            disabled={busy}
            activeOpacity={0.8}
          >
            {isShowingAd ? (
              <ActivityIndicator color={colors.auth.neon} />
            ) : (
              <>
                <Text style={styles.outlineButtonText}>TEST REWARDED AD</Text>
                <Text style={styles.chevron}>›</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outlineButton, styles.devResetButton, busy && styles.buttonDisabled]}
            onPress={handleResetUmpForDev}
            disabled={busy}
            activeOpacity={0.8}
          >
            {isResettingUmp ? (
              <ActivityIndicator color={colors.auth.neon} />
            ) : (
              <>
                <Text style={styles.outlineButtonText}>RESET UMP CONSENT</Text>
                <Text style={styles.chevron}>›</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

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
            <>
              <Image
                source={Icons.warning}
                style={[styles.outlineButtonIcon, styles.iconCoral]}
              />
              <Text style={styles.deleteButtonText}>DELETE ACCOUNT</Text>
              <Text style={[styles.chevron, styles.chevronDanger]}>›</Text>
            </>
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
    width: '100%',
    maxWidth: layout.formMaxWidth,
    alignSelf: 'center',
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
  devAdHint: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 13,
    color: colors.auth.statLabel,
    letterSpacing: 0.3,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  devResetButton: {
    marginTop: spacing.sm,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    minHeight: 52,
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.white,
    backgroundColor: colors.coral,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    flex: 1,
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 22,
    color: colors.white,
    letterSpacing: 0.5,
  },
  iconCoral: {
    tintColor: colors.white,
  },
  chevronDanger: {
    color: colors.coral,
  },
});
