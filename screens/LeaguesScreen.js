import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { fetchGlobalLeaderboard, getUserGlobalRank } from '../services/leagueService';
import { getUserId } from '../utils/userIdHelper';

export default function LeaguesScreen() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    const userId = await getUserId();
    setCurrentUserId(userId);
    await loadLeaderboardData(userId);
  };

  const loadLeaderboardData = async (userId) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch leaderboard and user rank in parallel
      const [leaderboardResult, rankResult] = await Promise.all([
        fetchGlobalLeaderboard(50),
        getUserGlobalRank(userId || currentUserId),
      ]);

      if (leaderboardResult.error) {
        throw leaderboardResult.error;
      }

      if (rankResult.error) {
        console.warn('Error fetching user rank:', rankResult.error);
      }

      setLeaderboard(leaderboardResult.data || []);
      setUserRank(rankResult);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeaderboardData(currentUserId);
    setRefreshing(false);
  }, [currentUserId]);

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
        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>🏆</Text>
          <Text style={styles.title}>Leagues</Text>
          <Text style={styles.subtitle}>Compete with other managers</Text>
        </View>
      </View>

      {/* Your Rank Card */}
      {userRank && userRank.rank && (
        <View style={[styles.card, styles.yourRankCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your Global Rank</Text>
            <Text style={styles.trophyEmoji}>🎯</Text>
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

      {/* Create/Join League - Coming Soon */}
      <View style={[styles.card, styles.actionsCard]}>
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>🔜 Coming Soon</Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, styles.disabledButton]}
          activeOpacity={1}
          disabled={true}>
          <Text style={styles.buttonIcon}>➕</Text>
          <Text style={styles.primaryButtonText}>Create Private League</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.disabledButton]}
          activeOpacity={1}
          disabled={true}>
          <Text style={styles.buttonIcon}>🔗</Text>
          <Text style={styles.secondaryButtonText}>Join Private League</Text>
        </TouchableOpacity>
      </View>

      {/* Global Leaderboard */}
      <View style={[styles.card, styles.leaderboardCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Global Leaderboard</Text>
          <Text style={styles.leaderboardIcon}>📊</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.oceanMedium} />
            <Text style={styles.loadingText}>Loading rankings...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadLeaderboardData(currentUserId)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : leaderboard.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🏊</Text>
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
              isCurrentUser={entry.user_id === currentUserId}
            />
          ))
        )}
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// Leaderboard Item Component
function LeaderboardItem({ entry, isCurrentUser }) {
  const getRankStyle = (rank) => {
    if (rank === 1) return styles.rankGold;
    if (rank === 2) return styles.rankSilver;
    if (rank === 3) return styles.rankBronze;
    return styles.rankDefault;
  };

  const getRankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <View
      style={[
        styles.leaderboardItem,
        isCurrentUser && styles.currentUserItem,
      ]}>
      <View style={[styles.rankBadge, getRankStyle(entry.rank)]}>
        {getRankEmoji(entry.rank) ? (
          <Text style={styles.rankEmoji}>{getRankEmoji(entry.rank)}</Text>
        ) : (
          <Text style={styles.rank}>{entry.rank}</Text>
        )}
      </View>
      <View style={styles.leaderboardInfo}>
        <Text style={[styles.leaderboardName, isCurrentUser && styles.currentUserName]}>
          {entry.team_name}
          {isCurrentUser && ' (You)'}
        </Text>
        <View style={styles.leaderboardMeta}>
          <View style={styles.pointsContainer}>
            <Text style={styles.leaderboardPoints}>{entry.total_points} pts</Text>
          </View>
          {entry.gameweeks_played > 0 && (
            <Text style={styles.gameweeksText}>
              {entry.gameweeks_played} GW{entry.gameweeks_played !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>
    </View>
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
    fontSize: 40,
    marginBottom: spacing.sm,
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
    backgroundColor: colors.white,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.large,
    ...shadows.medium,
    borderWidth: 1,
    borderColor: colors.oceanBright + '20',
  },
  yourRankCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    backgroundColor: colors.success + '05',
  },
  actionsCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.oceanMedium,
    position: 'relative',
  },
  leaderboardCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.turquoise,
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
    fontSize: 24,
  },
  leaderboardIcon: {
    fontSize: 24,
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
  comingSoonBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.medium,
    ...shadows.small,
    zIndex: 1,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.white,
  },
  primaryButton: {
    backgroundColor: colors.oceanMedium,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.small,
  },
  secondaryButton: {
    backgroundColor: colors.oceanBright + '30',
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.oceanBright,
    ...shadows.small,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonIcon: {
    fontSize: 18,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: colors.oceanDeep,
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
    fontSize: 48,
    marginBottom: spacing.sm,
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
    fontSize: 48,
    marginBottom: spacing.sm,
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
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '20',
  },
  currentUserItem: {
    backgroundColor: colors.oceanBright + '10',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.medium,
  },
  rankBadge: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    ...shadows.small,
  },
  rankGold: {
    backgroundColor: '#FFD700' + '30',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  rankSilver: {
    backgroundColor: '#C0C0C0' + '30',
    borderWidth: 2,
    borderColor: '#C0C0C0',
  },
  rankBronze: {
    backgroundColor: '#CD7F32' + '30',
    borderWidth: 2,
    borderColor: '#CD7F32',
  },
  rankDefault: {
    backgroundColor: colors.oceanBright + '20',
    borderWidth: 2,
    borderColor: colors.oceanBright,
  },
  rank: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  rankEmoji: {
    fontSize: 24,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  currentUserName: {
    color: colors.oceanDeep,
    fontWeight: '700',
  },
  leaderboardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pointsContainer: {
    backgroundColor: colors.oceanBright + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  leaderboardPoints: {
    fontSize: 14,
    color: colors.oceanDeep,
    fontWeight: '600',
  },
  gameweeksText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});

