import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Icons } from '../assets/images/icons';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import LeaderboardItem from '../components/LeaderboardItem';
import {
  fetchGlobalLeaderboard,
  getUserGlobalRank,
  fetchMyLeagues,
  createLeague,
  joinLeague,
} from '../services/leagueService';
import { reportTeamName } from '../services/userProfileService';

const NAME_PATTERN = /^[a-zA-Z0-9\s\-_'!]+$/;

function validateLeagueName(name) {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Please enter a league name' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'League name must be at least 3 characters' };
  }
  if (trimmed.length > 30) {
    return { isValid: false, error: 'League name must be less than 30 characters' };
  }
  if (!NAME_PATTERN.test(trimmed)) {
    return { isValid: false, error: 'League name contains invalid characters' };
  }
  return { isValid: true, error: '' };
}

function validateInviteCode(code) {
  const normalised = code.trim().toUpperCase();
  if (normalised.length === 0) {
    return { isValid: false, error: 'Please enter an invite code' };
  }
  if (!/^[A-Z0-9]{6}$/.test(normalised)) {
    return { isValid: false, error: 'Invite codes are 6 letters or numbers' };
  }
  return { isValid: true, error: '', code: normalised };
}

export default function LeaguesScreen({ navigation }) {
  const { userId } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [myLeagues, setMyLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [createVisible, setCreateVisible] = useState(false);
  const [joinVisible, setJoinVisible] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadScreenData = useCallback(async () => {
    setError(null);

    try {
      const [leaderboardResult, rankResult, leaguesResult] = await Promise.all([
        fetchGlobalLeaderboard(50),
        getUserGlobalRank(userId),
        fetchMyLeagues(),
      ]);

      if (leaderboardResult.error) {
        throw leaderboardResult.error;
      }

      if (rankResult.error) {
        console.warn('Error fetching user rank:', rankResult.error);
      }

      if (leaguesResult.error) {
        console.warn('Error fetching my leagues:', leaguesResult.error);
      }

      setLeaderboard(leaderboardResult.data || []);
      setUserRank(rankResult);
      setMyLeagues(leaguesResult.data || []);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadScreenData();
      }
    }, [userId, loadScreenData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadScreenData();
  }, [loadScreenData]);

  const openLeague = (league) => {
    navigation.navigate('LeagueDetail', {
      leagueId: league.id,
      leagueName: league.name,
      inviteCode: league.invite_code,
      createdBy: league.created_by,
    });
  };

  const handleReportTeamName = (entry) => {
    if (!entry?.user_id || entry.user_id === userId) return;

    Alert.alert(
      'Report team name?',
      `Report "${entry.team_name}" as offensive? We'll review it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            const { error: reportError } = await reportTeamName(entry.user_id);
            if (reportError) {
              const message = reportError.message?.includes('already reported')
                ? 'You already reported this team.'
                : reportError.message || 'Please try again.';
              Alert.alert("Couldn't send report", message);
              return;
            }
            Alert.alert('Report sent', 'Thanks — we will review this team name.');
          },
        },
      ]
    );
  };

  const closeCreateModal = () => {
    if (submitting) return;
    setCreateVisible(false);
    setLeagueName('');
  };

  const closeJoinModal = () => {
    if (submitting) return;
    setJoinVisible(false);
    setInviteCode('');
  };

  const handleCreateLeague = async () => {
    const validation = validateLeagueName(leagueName);
    if (!validation.isValid) {
      Alert.alert('Invalid league name', validation.error);
      return;
    }

    setSubmitting(true);
    const { data, error: createError } = await createLeague(leagueName.trim());
    setSubmitting(false);

    if (createError || !data) {
      Alert.alert(
        "Couldn't create league",
        createError?.message || 'Please try again.'
      );
      return;
    }

    setCreateVisible(false);
    setLeagueName('');
    const created = {
      id: data.id,
      name: data.name,
      invite_code: data.invite_code,
      created_by: userId,
      member_count: 1,
    };
    setMyLeagues((prev) => [
      created,
      ...prev.filter((league) => league.id !== data.id),
    ]);
    openLeague(created);
  };

  const handleJoinLeague = async () => {
    const validation = validateInviteCode(inviteCode);
    if (!validation.isValid) {
      Alert.alert('Invalid code', validation.error);
      return;
    }

    setSubmitting(true);
    const { data, error: joinError } = await joinLeague(validation.code);
    setSubmitting(false);

    if (joinError || !data) {
      const message = joinError?.message?.includes('Invalid league code')
        ? "That code doesn't match any league."
        : joinError?.message || 'Please try again.';
      Alert.alert("Couldn't join league", message);
      return;
    }

    setJoinVisible(false);
    setInviteCode('');

    const leaguesResult = await fetchMyLeagues();
    if (!leaguesResult.error) {
      setMyLeagues(leaguesResult.data || []);
    }

    const joined =
      (leaguesResult.data || []).find((league) => league.id === data.id) || {
        ...data,
        created_by: null,
      };
    openLeague(joined);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.oceanMedium}
            colors={[colors.oceanMedium]}
          />
        }>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image source={Icons.trophy} style={styles.headerEmoji} />
            <Text style={styles.title}>Leagues</Text>
            <Text style={styles.subtitle}>Compete with other managers</Text>
          </View>
        </View>

        {userRank && userRank.rank && (
          <View style={[styles.card, styles.yourRankCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Your Global Rank</Text>
              <Image source={Icons.goal} style={styles.trophyEmoji} />
            </View>
            <View style={styles.yourRankContent}>
              <View style={styles.yourRankMain}>
                <Text style={styles.yourRankNumber}>#{userRank.rank}</Text>
                <Text style={styles.yourRankPoints}>{userRank.totalPoints} pts</Text>
              </View>
              <Text style={styles.yourRankTotal}>
                of {userRank.totalUsers} managers
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.card, styles.actionsCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>My Leagues</Text>
            <Image source={Icons.handshake} style={styles.leaderboardIcon} />
          </View>

          {myLeagues.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No private leagues yet</Text>
              <Text style={styles.emptySubtext}>
                Create one and share the code, or join with a friend's code.
              </Text>
            </View>
          ) : (
            myLeagues.map((league) => (
              <TouchableOpacity
                key={league.id}
                style={styles.leagueRow}
                onPress={() => openLeague(league)}
                activeOpacity={0.7}>
                <View style={styles.leagueRowInfo}>
                  <Text style={styles.leagueRowName}>{league.name}</Text>
                  <Text style={styles.leagueRowMeta}>
                    {league.member_count} member{league.member_count !== 1 ? 's' : ''}
                    {league.created_by === userId ? ' · Admin' : ''}
                  </Text>
                </View>
                <Text style={styles.leagueRowChevron}>›</Text>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setCreateVisible(true)}>
            <Image source={Icons.handshake} style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Create Private League</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setJoinVisible(true)}>
            <Image source={Icons.handshake} style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Join Private League</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, styles.leaderboardCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Global Leaderboard</Text>
            <Image source={Icons.graph} style={styles.leaderboardIcon} />
          </View>
          <Text style={styles.reportHint}>
            Long-press a team to report an offensive name
          </Text>

          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.oceanMedium} />
              <Text style={styles.loadingText}>Loading rankings...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Image source={Icons.warning} style={styles.errorEmoji} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={loadScreenData}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : leaderboard.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Image source={Icons.wave} style={styles.emptyEmoji} />
              <Text style={styles.emptyText}>No rankings yet</Text>
              <Text style={styles.emptySubtext}>
                Be the first to build your team and score points!
              </Text>
            </View>
          ) : (
            leaderboard.map((entry) => (
              <LeaderboardItem
                key={entry.user_id}
                entry={entry}
                isCurrentUser={entry.user_id === userId}
                onLongPress={
                  entry.user_id !== userId
                    ? () => handleReportTeamName(entry)
                    : undefined
                }
              />
            ))
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <LeagueFormModal
        visible={createVisible}
        title="Create Private League"
        label="League name"
        value={leagueName}
        onChangeText={setLeagueName}
        placeholder="Office League"
        hint="3-30 characters • Letters, numbers & spaces"
        maxLength={30}
        autoCapitalize="words"
        submitLabel="Create league"
        submitting={submitting}
        onSubmit={handleCreateLeague}
        onClose={closeCreateModal}
      />

      <LeagueFormModal
        visible={joinVisible}
        title="Join Private League"
        label="Invite code"
        value={inviteCode}
        onChangeText={(text) => setInviteCode(text.toUpperCase())}
        placeholder="ABC123"
        hint="6-character code from the league admin"
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        submitLabel="Join league"
        submitting={submitting}
        onSubmit={handleJoinLeague}
        onClose={closeJoinModal}
      />
    </>
  );
}

function LeagueFormModal({
  visible,
  title,
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  maxLength,
  autoCapitalize,
  autoCorrect = true,
  submitLabel,
  submitting,
  onSubmit,
  onClose,
}) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity
          style={styles.modalDismiss}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalLabel}>{label}</Text>
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            maxLength={maxLength}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            autoFocus
            editable={!submitting}
          />
          <Text style={styles.modalHint}>{hint}</Text>
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabledButton]}
            onPress={onSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>{submitLabel}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalCancel}
            onPress={onClose}
            disabled={submitting}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    backgroundColor: colors.oceanDeep,
    paddingTop: 60,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...shadows.large,
  },
  headerContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  headerEmoji: {
    width: 48,
    height: 48,
    marginBottom: spacing.sm,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.oceanBright,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.pearl,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.large,
    ...shadows.medium,
    borderWidth: 1,
    borderColor: colors.sand + '50',
  },
  yourRankCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.sand,
    backgroundColor: colors.sand + '08',
  },
  actionsCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.coral,
  },
  leaderboardCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.sand,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  trophyEmoji: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  leaderboardIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  yourRankContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  yourRankMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  yourRankNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.success,
  },
  yourRankPoints: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textDark,
  },
  yourRankTotal: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '20',
  },
  leagueRowInfo: {
    flex: 1,
  },
  leagueRowName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.xs,
  },
  leagueRowMeta: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  leagueRowChevron: {
    fontSize: 28,
    color: colors.oceanMedium,
    fontWeight: '300',
    marginLeft: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.oceanMedium,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.small,
  },
  secondaryButton: {
    backgroundColor: colors.pearl,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.oceanMedium,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: colors.oceanMedium,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textMuted,
  },
  errorContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  errorEmoji: {
    width: 48,
    height: 48,
    marginBottom: spacing.sm,
    resizeMode: 'contain',
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.oceanMedium,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.medium,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyEmoji: {
    width: 48,
    height: 48,
    marginBottom: spacing.sm,
    resizeMode: 'contain',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  reportHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.pearl,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xl + 20,
    ...shadows.large,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.oceanDeep,
    marginBottom: spacing.sm,
  },
  modalInput: {
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
  modalHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  modalCancel: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
