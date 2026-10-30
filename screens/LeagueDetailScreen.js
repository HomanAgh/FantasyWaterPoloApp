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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icons } from '../assets/images/icons';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import LeaderboardItem from '../components/LeaderboardItem';
import {
  fetchLeagueLeaderboard,
  getUserLeagueRank,
  leaveLeague,
  kickLeagueMember,
} from '../services/leagueService';
import { reportTeamName } from '../services/userProfileService';
import { ensureScoutAccessThen } from '../services/scoutAccessService';

const PAGE_SIZE = 50;

export default function LeagueDetailScreen({ route, navigation }) {
  const {
    leagueId,
    leagueName,
    inviteCode,
    createdBy,
    scoringStartRoundNumber = null,
  } = route.params;
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();

  const isAdmin = createdBy === userId;

  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadLeagueData = useCallback(async () => {
    setError(null);

    try {
      const [leaderboardResult, rankResult] = await Promise.all([
        fetchLeagueLeaderboard(leagueId, PAGE_SIZE, 0),
        getUserLeagueRank(leagueId),
      ]);

      if (leaderboardResult.error) {
        throw leaderboardResult.error;
      }

      if (rankResult.error) {
        console.warn('Error fetching league rank:', rankResult.error);
      }

      const rows = leaderboardResult.data || [];
      setLeaderboard(rows);
      const totalMembers = rankResult?.totalMembers;
      setHasMore(
        typeof totalMembers === 'number'
          ? rows.length < totalMembers
          : rows.length >= PAGE_SIZE
      );
      setUserRank(rankResult);
    } catch (err) {
      console.error('Error loading league:', err);
      setError(err.message || 'Failed to load league');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueId]);

  const loadMoreLeaderboard = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const { data, error: moreError } = await fetchLeagueLeaderboard(
        leagueId,
        PAGE_SIZE,
        leaderboard.length
      );

      if (moreError) throw moreError;

      const rows = data || [];
      const seen = new Set(leaderboard.map(e => e.user_id));
      const unique = rows.filter(e => !seen.has(e.user_id));
      const next = [...leaderboard, ...unique];
      setLeaderboard(next);

      const totalMembers = userRank?.totalMembers;
      setHasMore(
        typeof totalMembers === 'number'
          ? next.length < totalMembers
          : rows.length >= PAGE_SIZE
      );
    } catch (err) {
      console.error('Error loading more league standings:', err);
      Alert.alert("Couldn't load more", 'Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, leagueId, leaderboard, userRank?.totalMembers]);

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

  const openViewTeam = (entry) => {
    if (!entry?.user_id) return;
    ensureScoutAccessThen({
      isOwnTeam: entry.user_id === userId,
      navigate: () =>
        navigation.navigate('ViewTeam', {
          userId: entry.user_id,
          teamName: entry.team_name,
        }),
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

  const memberCount = userRank?.totalMembers ?? leaderboard.length;
  const showLeaveButton = !isAdmin || memberCount <= 1;
  const leaveLabel =
    isAdmin && memberCount <= 1 ? 'DELETE LEAGUE' : 'LEAVE LEAGUE';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.auth.neon}
          colors={[colors.auth.neon]}
        />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>‹ BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={2}>
          {(leagueName || 'League').toUpperCase()}
        </Text>
        <Text style={styles.subtitle}>
          {isAdmin ? 'PRIVATE LEAGUE · ADMIN' : 'PRIVATE LEAGUE'}
        </Text>
        {scoringStartRoundNumber != null ? (
          <Text style={styles.scoringBadge}>
            SCORING FROM GAMEWEEK {scoringStartRoundNumber}
          </Text>
        ) : null}
      </View>

      {/* ── Invite Code ── */}
      {inviteCode ? (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>INVITE CODE</Text>
          <Text style={styles.codeValue} selectable>
            {inviteCode}
          </Text>
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Image source={Icons.letter} style={[styles.outlineButtonIcon, styles.iconNeon]} />
            <Text style={styles.outlineButtonText}>SHARE CODE</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Standings ── */}
      <View style={styles.leaderboardCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>STANDINGS</Text>
          <Image source={Icons.trophy} style={[styles.cardHeaderIcon, styles.iconNeon]} />
        </View>
        {scoringStartRoundNumber != null ? (
          <Text style={styles.scoringStandingsHint}>
            POINTS COUNT FROM GAMEWEEK {scoringStartRoundNumber} ONWARD
          </Text>
        ) : null}

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.auth.neon} />
            <Text style={styles.loadingText}>LOADING STANDINGS...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Image source={Icons.warning} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>{error.toUpperCase()}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadLeagueData}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        ) : leaderboard.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Image source={Icons.trophy} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>NO MEMBERS YET</Text>
            <Text style={styles.emptySubtext}>
              Share the invite code to{'\n'}add managers to this league.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.reportHint}>
              TAP VIEW TO SEE THEIR TEAM · LONG-PRESS TO REPORT
            </Text>
            {leaderboard.map((entry) => (
              <LeaderboardItem
                key={entry.user_id}
                entry={entry}
                isCurrentUser={entry.user_id === userId}
                onViewTeam={() => openViewTeam(entry)}
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
            ))}
            {hasMore ? (
              <TouchableOpacity
                style={[
                  styles.outlineButton,
                  styles.loadMoreButton,
                  loadingMore && styles.loadMoreButtonDisabled,
                ]}
                onPress={loadMoreLeaderboard}
                disabled={loadingMore}
                activeOpacity={0.8}
              >
                {loadingMore ? (
                  <ActivityIndicator color={colors.auth.neon} />
                ) : (
                  <>
                    <View style={styles.outlineButtonIconSpacer} />
                    <Text style={styles.outlineButtonText}>SHOW MORE</Text>
                    <Text style={styles.chevronDown}>›</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>

      {/* ── Leave / Admin hint ── */}
      {showLeaveButton ? (
        <View style={styles.actionsWrap}>
          <TouchableOpacity
            style={[styles.leaveButton, actionLoading && styles.leaveButtonDisabled]}
            onPress={handleLeave}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Image
                  source={Icons.warning}
                  style={[styles.outlineButtonIcon, styles.iconCoral]}
                />
                <Text style={styles.leaveButtonText}>{leaveLabel}</Text>
                <Text style={styles.leaveChevron}>›</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.adminHintCard}>
          <Image source={Icons.warning} style={styles.adminHintIcon} />
          <Text style={styles.adminHintText}>
            AS ADMIN YOU CANNOT LEAVE WHILE OTHERS ARE IN THE LEAGUE. KICK THEM
            FIRST, OR DELETE THE LEAGUE ONCE YOU ARE THE LAST MEMBER.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backButtonText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 14,
    color: colors.auth.neon,
    letterSpacing: 1,
  },
  title: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 40,
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  scoringBadge: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 14,
    color: colors.auth.neon,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  iconNeon: {
    tintColor: colors.auth.neon,
  },

  codeCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    alignItems: 'center',
  },
  codeLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  codeValue: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 36,
    color: colors.sand,
    letterSpacing: 6,
    marginBottom: spacing.md,
  },

  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    borderRadius: borderRadius.round,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
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
    fontSize: 24,
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
  chevronDown: {
    fontSize: 28,
    color: colors.auth.neon,
    fontWeight: '300',
    lineHeight: 28,
    marginTop: -2,
    transform: [{ rotate: '90deg' }],
  },
  outlineButtonIconSpacer: {
    width: 20,
    marginRight: spacing.sm,
  },

  leaderboardCard: {
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
  scoringStandingsHint: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 12,
    color: colors.auth.neon,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  reportHint: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 14,
    color: colors.auth.placeholder,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  loadMoreButton: {
    marginTop: spacing.md,
  },
  loadMoreButtonDisabled: {
    opacity: 0.7,
  },

  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 14,
    color: colors.auth.statLabel,
    letterSpacing: 1,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 22,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  retryButtonText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 14,
    color: colors.auth.neon,
    letterSpacing: 1,
  },

  actionsWrap: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    minHeight: 52,
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.white,
    backgroundColor: colors.coral,
  },
  leaveButtonDisabled: {
    opacity: 0.6,
  },
  leaveButtonText: {
    flex: 1,
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 22,
    color: colors.white,
    letterSpacing: 0.5,
  },
  leaveChevron: {
    fontSize: 28,
    color: colors.white,
    fontWeight: '300',
    lineHeight: 28,
    marginTop: -2,
  },
  iconCoral: {
    tintColor: colors.white,
  },

  adminHintCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.auth.inputBg,
    borderWidth: 0.5,
    borderColor: colors.sand,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  adminHintIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: colors.sand,
    marginTop: 2,
  },
  adminHintText: {
    flex: 1,
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 13,
    color: colors.white,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
});
