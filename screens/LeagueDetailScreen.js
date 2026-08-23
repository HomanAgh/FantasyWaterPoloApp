import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Share,
  Alert,
} from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import LeaderboardItem from '../components/LeaderboardItem';
import {
  fetchLeagueLeaderboard,
  getUserLeagueRank,
  leaveLeague,
  kickLeagueMember,
} from '../services/leagueService';
import { reportTeamName } from '../services/userProfileService';

export default function LeagueDetailScreen({ route, navigation }) {
  const { leagueId, leagueName, inviteCode, createdBy } = route.params;
  const { userId } = useAuth();

  const isAdmin = createdBy === userId;

  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadLeagueData = useCallback(async () => {
    setError(null);

    try {
      const [leaderboardResult, rankResult] = await Promise.all([
        fetchLeagueLeaderboard(leagueId, 50),
        getUserLeagueRank(leagueId),
      ]);

      if (leaderboardResult.error) {
        throw leaderboardResult.error;
      }

      if (rankResult.error) {
        console.warn('Error fetching league rank:', rankResult.error);
      }

      setLeaderboard(leaderboardResult.data || []);
      setUserRank(rankResult);
    } catch (err) {
      console.error('Error loading league:', err);
      setError(err.message || 'Failed to load league');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueId]);

  useEffect(() => {
    loadLeagueData();
  }, [loadLeagueData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeagueData();
  }, [loadLeagueData]);

  const handleShare = async () => {
    if (!inviteCode) return;

    try {
      await Share.share({
        message: `Join my Fantasy Water Polo league "${leagueName}" with code: ${inviteCode}`,
      });
    } catch (err) {
      console.error('Error sharing league code:', err);
      Alert.alert(
        'Share failed',
        'Could not open the share sheet. You can copy the code from this screen instead.'
      );
    }
  };

  const handleLeave = () => {
    const memberCount = userRank?.totalMembers ?? leaderboard.length;
    const isLastMember = isAdmin && memberCount <= 1;

    if (isAdmin && memberCount > 1) {
      Alert.alert(
        'Cannot leave',
        'As admin you must kick the other members first, or stay in the league. If you are the last member, leaving deletes the league.'
      );
      return;
    }

    Alert.alert(
      isLastMember ? 'Delete league?' : 'Leave league?',
      isLastMember
        ? `You are the last member. Leaving will permanently delete "${leagueName}".`
        : `Leave "${leagueName}"? You can rejoin later with the invite code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isLastMember ? 'Delete' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const { error: leaveError } = await leaveLeague(leagueId);
            setActionLoading(false);

            if (leaveError) {
              Alert.alert(
                "Couldn't leave league",
                leaveError.message || 'Please try again.'
              );
              return;
            }

            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleKick = (entry) => {
    Alert.alert(
      'Kick member?',
      `Remove ${entry.team_name} from "${leagueName}"? They can rejoin with the invite code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kick',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const { error: kickError } = await kickLeagueMember(
              leagueId,
              entry.user_id
            );
            setActionLoading(false);

            if (kickError) {
              Alert.alert(
                "Couldn't kick member",
                kickError.message || 'Please try again.'
              );
              return;
            }

            await loadLeagueData();
          },
        },
      ]
    );
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

  const memberCount = userRank?.totalMembers ?? leaderboard.length;
  const showLeaveButton = !isAdmin || memberCount <= 1;
  const leaveLabel =
    isAdmin && memberCount <= 1 ? 'Delete league' : 'Leave league';

  return (
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Image source={Icons.trophy} style={styles.headerEmoji} />
          <Text style={styles.title}>{leagueName || 'League'}</Text>
          <Text style={styles.subtitle}>
            {isAdmin ? 'Private league · Admin' : 'Private league'}
          </Text>
        </View>
      </View>

      {inviteCode ? (
        <View style={[styles.card, styles.codeCard]}>
          <Text style={styles.codeLabel}>Invite code</Text>
          <Text style={styles.codeValue} selectable>
            {inviteCode}
          </Text>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Image source={Icons.handshake} style={styles.buttonIcon} />
            <Text style={styles.shareButtonText}>Share code</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {userRank && userRank.rank && (
        <View style={[styles.card, styles.yourRankCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your Rank</Text>
            <Image source={Icons.goal} style={styles.cardIcon} />
          </View>
          <View style={styles.yourRankContent}>
            <View style={styles.yourRankMain}>
              <Text style={styles.yourRankNumber}>#{userRank.rank}</Text>
              <Text style={styles.yourRankPoints}>{userRank.totalPoints} pts</Text>
            </View>
            <Text style={styles.yourRankTotal}>
              of {userRank.totalMembers} managers
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.card, styles.leaderboardCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Standings</Text>
          <Image source={Icons.graph} style={styles.cardIcon} />
        </View>
        <Text style={styles.reportHint}>
          Long-press a team to report an offensive name
        </Text>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.oceanMedium} />
            <Text style={styles.loadingText}>Loading standings...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Image source={Icons.warning} style={styles.errorEmoji} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadLeagueData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : leaderboard.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Image source={Icons.wave} style={styles.emptyEmoji} />
            <Text style={styles.emptyText}>No members yet</Text>
          </View>
        ) : (
          leaderboard.map((entry) => (
            <LeaderboardItem
              key={entry.user_id}
              entry={entry}
              isCurrentUser={entry.user_id === userId}
              onKick={
                isAdmin && entry.user_id !== userId
                  ? () => handleKick(entry)
                  : undefined
              }
              onLongPress={
                entry.user_id !== userId
                  ? () => handleReportTeamName(entry)
                  : undefined
              }
            />
          ))
        )}
      </View>

      {showLeaveButton ? (
        <View style={styles.actionsWrap}>
          <TouchableOpacity
            style={[styles.leaveButton, actionLoading && styles.leaveButtonDisabled]}
            onPress={handleLeave}
            disabled={actionLoading}>
            {actionLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.leaveButtonText}>{leaveLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.adminHintCard}>
          <Text style={styles.adminHintText}>
            As admin you cannot leave while others are in the league. Kick them
            first, or delete the league once you are the last member.
          </Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
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
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButtonText: {
    color: colors.oceanBright,
    fontSize: 15,
    fontWeight: '600',
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
    textAlign: 'center',
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
  codeCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.coral,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.oceanDeep,
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  shareButton: {
    backgroundColor: colors.oceanMedium,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.small,
  },
  shareButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  yourRankCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.sand,
    backgroundColor: colors.sand + '08',
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
  reportHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  cardIcon: {
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
    fontWeight: '600',
  },
  actionsWrap: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  leaveButton: {
    backgroundColor: colors.coral,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...shadows.small,
  },
  leaveButtonDisabled: {
    opacity: 0.6,
  },
  leaveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  adminHintCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.pearl,
    borderWidth: 1,
    borderColor: colors.sand + '50',
  },
  adminHintText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});
