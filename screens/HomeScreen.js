import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';
import { fetchPlayers } from '../services/playerService';
import { fetchFixturesForRound } from '../services/fixtureService';
import { fetchNextRound, getRoundStatus } from '../services/roundService';
import { useTeam } from '../context/TeamContext';
import { useRound } from '../context/RoundContext';

// Same Figma title export as AuthScreen — drop into assets/images/ then set:
const AUTH_TITLE = null; // require('../assets/images/auth-title.png')

export default function HomeScreen({ navigation }) {
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gameweekPoints, setGameweekPoints] = useState(0);
  const [upcomingFixtures, setUpcomingFixtures] = useState([]);
  const [upcomingFixturesRound, setUpcomingFixturesRound] = useState(null);

  const {
    selectedPlayers,
    remainingBudget,
    totalSpent,
    calculateGameweekPoints,
    teamName,
    lockedTotalPoints,
    squadFinalized,
    isLoading: isTeamLoading,
    teamLoadError,
    loadUserTeam,
    MAX_PLAYERS,
    MAX_GOALKEEPERS,
    MAX_OUTFIELD,
  } = useTeam();

  const { currentRound, isLocked, timeToDeadline, formatDeadline } = useRound();

  const overallTotalPoints = lockedTotalPoints;

  const gkCount = selectedPlayers.filter(p => p.position === 'GK').length;
  const outfieldCount = selectedPlayers.filter(p => p.position === 'Outfield').length;
  const isTeamComplete =
    selectedPlayers.length === MAX_PLAYERS &&
    gkCount === MAX_GOALKEEPERS &&
    outfieldCount === MAX_OUTFIELD;
  // Don't treat a failed/pending sync as an "incomplete squad" nudge
  const showIncompleteNudge =
    !isTeamLoading && !teamLoadError && !isTeamComplete && selectedPlayers.length > 0;

  useEffect(() => {
    loadPlayerStats();
  }, []);

  useEffect(() => {
    if (currentRound && selectedPlayers.length > 0) {
      loadGameweekPoints();
    }
  }, [currentRound, selectedPlayers]);

  useEffect(() => {
    if (currentRound) {
      loadUpcomingFixtures();
    }
  }, [currentRound]);

  const loadPlayerStats = async () => {
    setLoading(true);
    const { data, error } = await fetchPlayers();

    if (!error && data) {
      setPlayerCount(data.length);
    }

    setLoading(false);
  };

  const loadGameweekPoints = async () => {
    if (!currentRound) return;
    const points = await calculateGameweekPoints(currentRound.id);
    setGameweekPoints(points);
  };

  const loadUpcomingFixtures = async () => {
    if (!currentRound) return;

    let fixturesRound = currentRound;
    let upcoming = [];

    const { data, error } = await fetchFixturesForRound(currentRound.id);

    if (!error && data) {
      upcoming = data.filter(f => f.status === 'scheduled');
    }

    // Live/completed GW with no remaining scheduled matches → show next GW
    const status = getRoundStatus(currentRound);
    if (upcoming.length === 0 && (status === 'active' || status === 'completed')) {
      const { data: nextRound } = await fetchNextRound(currentRound.round_number);
      if (nextRound) {
        const { data: nextFixtures, error: nextError } = await fetchFixturesForRound(nextRound.id);
        if (!nextError && nextFixtures) {
          upcoming = nextFixtures.filter(f => f.status === 'scheduled');
          fixturesRound = nextRound;
        }
      }
    }

    setUpcomingFixtures(upcoming);
    setUpcomingFixturesRound(fixturesRound);
  };

  const countdownLabel = () => {
    if (!timeToDeadline) return null;
    if (timeToDeadline.days > 0) {
      return `${timeToDeadline.days}D ${timeToDeadline.hours}H`;
    }
    if (timeToDeadline.hours > 0) {
      return `${timeToDeadline.hours}H ${timeToDeadline.minutes}M`;
    }
    return `${timeToDeadline.minutes}M`;
  };

  const renderHero = () => {
    if (AUTH_TITLE) {
      return (
        <Image source={AUTH_TITLE} style={styles.titleImage} resizeMode="contain" />
      );
    }

    return (
      <View style={styles.heroFallback}>
        <Text style={styles.appTitle}>FANTASY{'\n'}WATER POLO</Text>
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>DIVE INTO THE ACTION</Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>{renderHero()}</View>

      {currentRound && (
        <View style={styles.gameweekBlock}>
          <Text style={styles.gameweekLabel}>
            GAMEWEEK {currentRound.round_number}
          </Text>
          {isLocked ? (
            <View style={styles.deadlineRow}>
              <Image source={Icons.locked} style={styles.deadlineIcon} />
              <Text style={styles.deadlineText}>LIVE</Text>
            </View>
          ) : (
            <Text style={styles.deadlineText}>
              DEADLINE: {formatDeadline(currentRound.deadline)}
            </Text>
          )}
          {!isLocked && timeToDeadline && (
            <View style={styles.countdownPill}>
              <Image source={Icons.clock} style={styles.countdownIcon} />
              <Text style={styles.countdownText}>DEADLINE: {countdownLabel()}</Text>
            </View>
          )}
        </View>
      )}

      {/* Points */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>POINTS</Text>
          <Image source={Icons.points} style={[styles.cardHeaderIcon, styles.iconNeon]} />
        </View>

        <View style={styles.pointsRow}>
          <TouchableOpacity
            style={styles.pointsCircle}
            onPress={() => navigation.navigate('MyTeam')}
            activeOpacity={0.7}
          >
            <Text style={styles.pointsCircleLabel}>
              {isLocked ? 'GW LIVE' : `GW${currentRound?.round_number || 1}`}
            </Text>
            <Text style={styles.pointsCircleValue}>{gameweekPoints}</Text>
            <Text style={styles.historyHint}>TAP FOR HISTORY</Text>
          </TouchableOpacity>

          <View style={[styles.pointsCircle, styles.pointsCircleTotal]}>
            <Text style={styles.pointsCircleLabel}>TOTAL</Text>
            <Text style={styles.pointsCircleValue}>
              {squadFinalized ? overallTotalPoints : gameweekPoints}
            </Text>
            <Text style={[styles.historyHint, styles.historyHintSpacer]}>TAP FOR HISTORY</Text>
          </View>
        </View>
      </View>

      {/* Team */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {(teamName || 'MY TEAM').toUpperCase()}
          </Text>
          <Image source={Icons.teambadge} style={[styles.cardHeaderIcon, styles.iconNeon]} />
        </View>

        {loading || isTeamLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.auth.neon} />
            {isTeamLoading && (
              <Text style={styles.syncText}>Syncing your team…</Text>
            )}
          </View>
        ) : teamLoadError ? (
          <View style={styles.syncErrorBox}>
            <Text style={styles.syncErrorText}>{teamLoadError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadUserTeam()}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>TRY AGAIN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.selectionText}>
              {selectedPlayers.length}/{MAX_PLAYERS} players selected
            </Text>

            {showIncompleteNudge && (
              <View style={styles.nudgeBox}>
                <Text style={styles.nudgeTitle}>
                  {selectedPlayers.length < MAX_PLAYERS
                    ? `Add ${MAX_PLAYERS - selectedPlayers.length} more to complete your squad`
                    : 'Finish setting your squad'}
                </Text>
                {gkCount < MAX_GOALKEEPERS && (
                  <Text style={styles.nudgeText}>
                    • Need {MAX_GOALKEEPERS - gkCount} more goalkeeper(s)
                  </Text>
                )}
                {outfieldCount < MAX_OUTFIELD && (
                  <Text style={styles.nudgeText}>
                    • Need {MAX_OUTFIELD - outfieldCount} more field player(s)
                  </Text>
                )}
              </View>
            )}

            {isTeamComplete && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✓ Team is complete!</Text>
              </View>
            )}

            <View style={styles.budgetBar}>
              <Text style={styles.budgetLabel}>BUDGET REMAINING:</Text>
              <Text style={styles.budgetAmount}>${remainingBudget.toFixed(1)}M</Text>
            </View>

            <Text style={styles.cardInfo}>
              Spent ${totalSpent.toFixed(1)}M of $100.0M. {playerCount} players available in the player pool.
            </Text>
          </>
        )}

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => navigation.navigate('MyTeam')}
          activeOpacity={0.8}
        >
          <Image source={Icons.teameye} style={[styles.outlineButtonIcon, styles.iconNeon]} />
          <Text style={styles.outlineButtonText}>VIEW TEAM</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>QUICK ACTIONS</Text>
          <Image source={Icons.sprint} style={[styles.cardHeaderIcon, styles.iconNeon]} />
        </View>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => navigation.navigate('Players')}
          activeOpacity={0.8}
        >
          <Image source={Icons.folder} style={[styles.outlineButtonIcon, styles.iconNeon]} />
          <Text style={styles.outlineButtonText}>BROWSE PLAYERS</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => navigation.navigate('Transfers')}
          activeOpacity={0.8}
        >
          <Image source={Icons.swap} style={[styles.outlineButtonIcon, styles.iconNeon]} />
          <Text style={styles.outlineButtonText}>MAKE TRANSFERS</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => navigation.navigate('Leagues')}
          activeOpacity={0.8}
        >
          <Image source={Icons.join} style={[styles.outlineButtonIcon, styles.iconNeon]} />
          <Text style={styles.outlineButtonText}>JOIN LEAGUE</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Upcoming Fixtures */}
      <View style={[styles.card, styles.lastCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>UPCOMING FIXTURES</Text>
          <Image source={Icons.calendar} style={[styles.cardHeaderIcon, styles.iconNeon]} />
        </View>

        {upcomingFixturesRound &&
          currentRound &&
          upcomingFixturesRound.id !== currentRound.id &&
          upcomingFixtures.length > 0 && (
            <Text style={styles.fixturesRoundLabel}>
              GAMEWEEK {upcomingFixturesRound.round_number}
            </Text>
          )}

        {upcomingFixtures.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Image source={Icons.bigcalender} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>NO FIXTURES SCHEDULED</Text>
            <Text style={styles.emptySubtext}>Check back soon for more matches.</Text>
          </View>
        ) : (
          upcomingFixtures.map((fixture) => (
            <View key={fixture.id} style={styles.fixtureRow}>
              <View style={styles.fixtureTeams}>
                <Text style={[styles.fixtureTeam, styles.fixtureTeamHome]} numberOfLines={1}>
                  {fixture.home_team?.name || 'TBD'}
                </Text>
                <Text style={styles.fixtureVs}>vs</Text>
                <Text style={[styles.fixtureTeam, styles.fixtureTeamAway]} numberOfLines={1}>
                  {fixture.away_team?.name || 'TBD'}
                </Text>
              </View>
              <Text style={styles.fixtureDate}>
                {new Date(fixture.match_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))
        )}
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
  hero: {
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  titleImage: {
    width: '100%',
    height: 140,
  },
  heroFallback: {
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    transform: [{ rotate: '-2deg' }],
  },
  ribbonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.oceanDeep,
  },
  gameweekBlock: {
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.sand,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.auth.glass
  },
  gameweekLabel: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 22,
    color: colors.sand,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  deadlineIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: colors.white,
  },
  deadlineText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.white,
    letterSpacing: 0.5,
    marginBottom: spacing.xxs,
    textAlign: 'center',
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginHorizontal: spacing.md,
    backgroundColor: colors.auth.inputBg,
    borderWidth: 0.5,
    borderColor: colors.sand,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg + 4,
  },
  countdownIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: colors.sand,
  },
  countdownText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 16,
    color: colors.sand,
    letterSpacing: 0.5,
  },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  lastCard: {
    marginBottom: spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Bleed to card edges so the divider spans full width
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    paddingHorizontal: spacing.lg,
    // Equal space above text/icon and below (to the divider)
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.auth.neon,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 1,
    marginRight: spacing.sm,
  },
  cardHeaderIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  iconNeon: {
    tintColor: colors.auth.neon,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: spacing.md,
  },
  pointsCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3.5,
    borderColor: colors.auth.statLabel,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  // Fine-tune TOTAL label/number — raise paddingTop / lower paddingBottom to move content down
  pointsCircleTotal: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  pointsCircleLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 12,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    marginBottom: 2,
  },
  pointsCircleValue: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 56,
    color: colors.white,
    lineHeight: 46,
  },
  historyHint: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 12,
    color: colors.auth.statLabel,
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
  historyHintSpacer: {
    opacity: 0,
  },
  selectionText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 24,
    color: colors.sand,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  warningBox: {
    backgroundColor: colors.coral + '22',
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.coral,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  warningIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  warningText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 13,
    color: colors.white,
  },
  nudgeBox: {
    backgroundColor: colors.auth.inputBg,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.sand,
  },
  nudgeTitle: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 14,
    color: colors.sand,
    marginBottom: spacing.xs,
  },
  nudgeText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 13,
    color: colors.white,
  },
  syncText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 13,
    color: colors.auth.placeholder,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  syncErrorBox: {
    backgroundColor: colors.auth.inputBg,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.coral,
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncErrorText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 14,
    color: colors.white,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.xs,
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
  successBox: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.success,
    alignItems: 'center',
  },
  successText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 14,
    color: colors.success,
  },
  budgetBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.auth.inputBg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.small,
    borderWidth: 0.5,
    borderColor: colors.auth.neonSoft,
    marginBottom: spacing.sm,
  },
  budgetLabel: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 0.5,
  },
  budgetAmount: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 18,
    color: colors.sand,
  },
  cardInfo: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    borderRadius: borderRadius.round,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
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
  fixturesRoundLabel: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 14,
    color: colors.sand,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: spacing.lg,
    
    marginBottom: spacing.md,
    opacity: 0.9,
  },
  emptyText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 24,
    color: '#7CB2FF',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 18,
    color: colors.white,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  fixtureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.auth.neonSoft,
  },
  fixtureTeams: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fixtureTeam: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.white,
    flex: 1,
  },
  fixtureTeamHome: {
    textAlign: 'right',
  },
  fixtureTeamAway: {
    textAlign: 'left',
  },
  fixtureVs: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 14,
    color: colors.auth.placeholder,
    textAlign: 'center',
    minWidth: 28,
    flexShrink: 0,
    lineHeight: 18,
  },
  fixtureDate: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.auth.placeholder,
    marginLeft: spacing.sm,
  },
});
