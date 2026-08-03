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
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { fetchPlayers } from '../services/playerService';
import { fetchFixturesForRound } from '../services/fixtureService';
import { useTeam } from '../context/TeamContext';
import { useRound } from '../context/RoundContext';

export default function HomeScreen({ navigation }) {
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gameweekPoints, setGameweekPoints] = useState(0);
  const [upcomingFixtures, setUpcomingFixtures] = useState([]);

  // Get team stats from context
  const {
    selectedPlayers,
    remainingBudget,
    totalSpent,
    calculateGameweekPoints,
    teamName,
    lockedTotalPoints,
    pendingDeductions,
    squadFinalized,
  } = useTeam();

  // Get round info from context
  const { currentRound, isLocked, timeToDeadline, formatDeadline } = useRound();

  // Overall total comes directly from the DB (global_leaderboard via get_user_global_rank).
  // That view already includes all rounds including the current one, so we do NOT
  // add gameweekPoints on top — that would double-count the current GW.
  const overallTotalPoints = lockedTotalPoints;

  // Calculate team completeness
  const gkCount = selectedPlayers.filter(p => p.position === 'GK').length;
  const outfieldCount = selectedPlayers.filter(p => p.position === 'Outfield').length;
  const isTeamComplete = selectedPlayers.length === 12 && gkCount === 2 && outfieldCount === 10;

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
    
    const { data, error } = await fetchFixturesForRound(currentRound.id);
    
    if (!error && data) {
      // Filter to only scheduled matches and take first 3
      const upcoming = data
        .filter(f => f.status === 'scheduled')
        .slice(0, 3);
      setUpcomingFixtures(upcoming);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Ocean-themed header with gradient effect */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image source={Icons.wave} style={styles.waveEmoji} />
          <Text style={styles.title}>Fantasy Water Polo</Text>
          <Text style={styles.subtitle}>Dive into the action!</Text>
        </View>
      </View>

      {/* Gameweek Banner */}
      {currentRound && (
        <View style={styles.gameweekBanner}>
          <View style={styles.gameweekInfo}>
            <Text style={styles.gameweekLabel}>Gameweek {currentRound.round_number}</Text>
            {isLocked ? (
              <View style={styles.deadlineRow}>
                <Image source={Icons.locked} style={styles.deadlineIcon} />
                <Text style={styles.deadlineText}>LIVE</Text>
              </View>
            ) : (
              <View style={styles.deadlineRow}>
                <Image source={Icons.clock} style={styles.deadlineIcon} />
                <Text style={styles.deadlineText}>Deadline: {formatDeadline(currentRound.deadline)}</Text>
              </View>
            )}
          </View>
          {!isLocked && timeToDeadline && (
            <View style={styles.countdown}>
              <Text style={styles.countdownText}>
                {timeToDeadline.days > 0 
                  ? `${timeToDeadline.days}d ${timeToDeadline.hours}h`
                  : timeToDeadline.hours > 0
                  ? `${timeToDeadline.hours}h ${timeToDeadline.minutes}m`
                  : `${timeToDeadline.minutes}m`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Points Summary Card */}
      <View style={[styles.card, styles.pointsCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Points</Text>
          <Image source={Icons.water} style={styles.waveIcon} />
        </View>

        {/* GW points row */}
        <View style={styles.pointsRow}>
          <View style={styles.pointsBlock}>
            <Text style={styles.pointsLabel}>
              {isLocked ? 'GW Live' : `GW ${currentRound?.round_number || 1}`}
            </Text>
            <Text style={styles.pointsValue}>{gameweekPoints}</Text>
            {pendingDeductions > 0 && (
              <Text style={styles.deductionNote}>-{pendingDeductions} hit</Text>
            )}
            {isLocked && (
              <Text style={styles.liveIndicator}>● LIVE</Text>
            )}
          </View>

          <View style={styles.pointsDivider} />

          <View style={styles.pointsBlock}>
            <Text style={styles.pointsLabel}>Total</Text>
            <Text style={[styles.pointsValue, styles.pointsValueTotal]}>
              {squadFinalized ? overallTotalPoints : gameweekPoints}
            </Text>
            {squadFinalized && (
              <Text style={styles.pointsSubLabel}>all gameweeks</Text>
            )}
          </View>
        </View>
      </View>

      {/* Team Overview Card */}
      <View style={[styles.card, styles.teamCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{teamName}</Text>
          <Image source={Icons.swimmer} style={styles.teamIcon} />
        </View>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.oceanMedium} />
          </View>
        ) : (
          <>
            <Text style={styles.cardSubtext}>
              {selectedPlayers.length}/12 players selected
            </Text>
            {!isTeamComplete && selectedPlayers.length > 0 && (
              <View style={styles.warningBox}>
                <View style={styles.warningRow}>
                  <Image source={Icons.warning} style={styles.warningIcon} />
                  <Text style={styles.warningText}>Team incomplete: Need {12 - selectedPlayers.length} more player(s)</Text>
                </View>
                {gkCount < 2 && (
                  <Text style={styles.warningText}>
                    • Need {2 - gkCount} more goalkeeper(s)
                  </Text>
                )}
                {outfieldCount < 10 && (
                  <Text style={styles.warningText}>
                    • Need {10 - outfieldCount} more field player(s)
                  </Text>
                )}
              </View>
            )}
            {isTeamComplete && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✓ Team is complete!</Text>
              </View>
            )}
            <View style={styles.budgetInfo}>
              <Text style={styles.budgetLabel}>Budget Remaining:</Text>
              <Text style={styles.budgetAmount}>${remainingBudget.toFixed(1)}M</Text>
            </View>
            <Text style={styles.cardInfo}>
              Spent: ${totalSpent.toFixed(1)}M of $100.0M
            </Text>
            <Text style={styles.cardInfo}>
              {playerCount} players available in database
            </Text>
          </>
        )}
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('MyTeam')}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>View Team</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions with ocean colors */}
      <View style={[styles.card, styles.quickActionsCard]}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButton1]}
          onPress={() => navigation.navigate('Players')}
          activeOpacity={0.8}>
          <Image source={Icons.player} style={styles.actionButtonIcon} />
          <Text style={styles.actionButtonText}>Browse Players</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButton2]}
          onPress={() => navigation.navigate('Transfers')}
          activeOpacity={0.8}>
          <Image source={Icons.swap} style={styles.actionButtonIcon} />
          <Text style={styles.actionButtonText}>Make Transfers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButton3]}
          onPress={() => navigation.navigate('Leagues')}
          activeOpacity={0.8}>
          <Image source={Icons.trophy} style={styles.actionButtonIcon} />
          <Text style={styles.actionButtonText}>Join League</Text>
        </TouchableOpacity>
      </View>

      {/* Upcoming Fixtures */}
      <View style={[styles.card, styles.fixturesCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Upcoming Fixtures</Text>
          <Image source={Icons.calendar} style={styles.fixtureIcon} />
        </View>
        {upcomingFixtures.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No fixtures scheduled</Text>
            <Text style={styles.emptySubtext}>Check back soon for matches!</Text>
          </View>
        ) : (
          upcomingFixtures.map((fixture) => (
            <View key={fixture.id} style={styles.fixtureRow}>
              <View style={styles.fixtureTeams}>
                <Text style={styles.fixtureTeam} numberOfLines={1}>
                  {fixture.home_team?.name || 'TBD'}
                </Text>
                <Text style={styles.fixtureVs}>vs</Text>
                <Text style={styles.fixtureTeam} numberOfLines={1}>
                  {fixture.away_team?.name || 'TBD'}
                </Text>
              </View>
              <Text style={styles.fixtureDate}>
                {new Date(fixture.match_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
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
    backgroundColor: colors.backgroundLight,
  },
  header: {
    backgroundColor: colors.oceanDeep,
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...shadows.large,
  },
  headerContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  waveEmoji: {
    width: 48,
    height: 48,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 5,
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
  pointsCard: {
    backgroundColor: colors.pearl,
    borderLeftWidth: 4,
    borderLeftColor: colors.sand,
  },
  teamCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.sand,
  },
  fixturesCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.oceanBright,
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
  waveIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  teamIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  fixtureIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
  },
  pointsBlock: {
    flex: 1,
    alignItems: 'center',
  },
  pointsDivider: {
    width: 1,
    height: 64,
    backgroundColor: colors.oceanBright + '40',
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  pointsSubLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  pointsValue: {
    fontSize: 52,
    fontWeight: 'bold',
    color: colors.sand,
    textAlign: 'center',
  },
  pointsValueTotal: {
    color: colors.sand,
  },
  deductionNote: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 2,
  },
  cardSubtext: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  warningBox: {
    backgroundColor: colors.coral + '18',
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.coral,
  },
  warningText: {
    fontSize: 13,
    color: colors.coral,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  successBox: {
    backgroundColor: '#D1FAE5',
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    alignItems: 'center',
  },
  successText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '700',
  },
  budgetInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.oceanBright + '20',
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.oceanBright,
  },
  budgetLabel: {
    fontSize: 14,
    color: colors.oceanDeep,
    fontWeight: '600',
  },
  budgetAmount: {
    fontSize: 18,
    color: colors.teal,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: colors.oceanMedium,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginTop: spacing.md,
    ...shadows.small,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oceanMedium,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginTop: spacing.sm,
    ...shadows.small,
  },
  quickActionsCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.coral,
  },
  actionButton1: {},
  actionButton2: {},
  actionButton3: {},
  actionButtonIcon: {
    width: 24,
    height: 24,
    marginRight: spacing.sm,
    resizeMode: 'contain',
    tintColor: colors.white,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cardInfo: {
    fontSize: 14,
    color: colors.oceanMedium,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  gameweekBanner: {
    backgroundColor: colors.oceanDeep,
    marginHorizontal: spacing.md,
    marginTop: -15,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    ...shadows.medium,
    borderWidth: 2,
    borderColor: colors.oceanBright,
  },
  gameweekInfo: {
    marginBottom: spacing.sm,
  },
  gameweekLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deadlineIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  deadlineText: {
    fontSize: 14,
    color: colors.oceanBright,
    fontWeight: '600',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.xs,
  },
  warningIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  countdown: {
    backgroundColor: colors.oceanBright + '30',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.oceanBright,
  },
  countdownText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
    letterSpacing: 1,
  },
  liveIndicator: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.coral,
    marginTop: spacing.sm,
    letterSpacing: 2,
  },
  fixtureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '20',
  },
  fixtureTeams: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fixtureTeam: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
    flex: 1,
  },
  fixtureVs: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    paddingHorizontal: spacing.xs,
  },
  fixtureDate: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    marginLeft: spacing.sm,
  },
});

