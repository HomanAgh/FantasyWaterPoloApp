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
import { fetchPlayerDetail } from '../services/playerService';

export default function PlayerDetailScreen({ route, navigation }) {
  const { playerId, player: playerPreview } = route.params;

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDetail();
  }, [playerId]);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchPlayerDetail(playerId);
    if (fetchError || !data) {
      setError('Failed to load player details.');
    } else {
      setDetail(data);
    }
    setLoading(false);
  };

  const isGK = (detail?.position || playerPreview?.position) === 'GK';

  const getFormColor = (pts) => {
    if (pts >= 8) return colors.success;
    if (pts >= 4) return colors.warning;
    if (pts > 0) return colors.oceanMedium;
    return colors.textMuted + '60';
  };

  const formatMatchOpponent = (match) => {
    if (!match?.fixture) return 'Unknown';
    const { fixture } = match;
    const homeTeam = fixture.home_team?.name || '?';
    const awayTeam = fixture.away_team?.name || '?';
    const homeScore = fixture.home_score ?? '-';
    const awayScore = fixture.away_score ?? '-';
    const round = fixture.round?.round_number;
    return {
      label: `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
      round: round ? `GW${round}` : '',
      status: fixture.status,
    };
  };

  const getMatchResult = (match) => {
    if (!match?.fixture || match.fixture.status !== 'finished') return null;
    return `${match.fixture.home_score ?? '-'}-${match.fixture.away_score ?? '-'}`;
  };

  // Use preview data for the header while full data loads
  const displayName = detail?.name || playerPreview?.name || '...';
  const displayTeam = detail?.team || playerPreview?.team || '';
  const displayPosition = detail?.position || playerPreview?.position || '';
  const displayPrice = detail?.price ?? playerPreview?.price;
  const displayTotalPoints = detail?.totalPoints ?? playerPreview?.points ?? 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerBody}>
        <Image source={isGK ? Icons.goalie : Icons.player} style={styles.positionEmoji} />
          <Text style={styles.playerName}>{displayName}</Text>
          <Text style={styles.playerTeam}>{displayTeam}</Text>

          <View style={styles.headerBadges}>
            <View style={styles.positionBadge}>
              <Text style={styles.positionBadgeText}>
                {isGK ? 'Goalkeeper' : 'Field Player'}
              </Text>
            </View>
          </View>

          <View style={styles.headerStats}>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatValue}>
                {displayPrice != null ? `$${displayPrice.toFixed(1)}M` : '-'}
              </Text>
              <Text style={styles.headerStatLabel}>Price</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatValue}>{displayTotalPoints}</Text>
              <Text style={styles.headerStatLabel}>Total Pts</Text>
            </View>
            {detail && (
              <>
                <View style={styles.headerStatDivider} />
                <View style={styles.headerStatItem}>
                  <Text style={styles.headerStatValue}>{detail.pointsPerGame}</Text>
                  <Text style={styles.headerStatLabel}>Pts/Game</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.oceanMedium} />
          <Text style={styles.loadingText}>Loading stats...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDetail}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {detail && !loading && (
        <>
          {/* Season Stats Grid */}
          <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Image source={Icons.graph} style={styles.sectionTitleIcon} />
            <Text style={styles.sectionTitle}>Season Stats</Text>
          </View>
            <View style={styles.statsGrid}>
              {isGK ? (
                <>
                  <StatCell label="Saves" value={detail.totalSaves} icon={Icons.gloves} />
                  <StatCell label="Clean Sheet Periods" value={detail.totalCleanSheets} icon={Icons.cleansheet} />
                  <StatCell label="Blocks" value={detail.totalBlocks} icon={Icons.block} />
                  <StatCell label="Sprints" value={detail.totalSprints} icon={Icons.sprint} />
                  <StatCell label="Games" value={detail.gamesPlayed} icon={Icons.games} />
                  <StatCell label="Minutes" value={detail.totalMinutes} icon={Icons.clock} />
                  <StatCell label="Red Cards" value={detail.totalReds} icon={Icons.redCard} danger={detail.totalReds > 0} />
                </>
              ) : (
                <>
                  <StatCell label="Goals" value={detail.totalGoals} icon={Icons.goal} />
                  <StatCell label="Assists" value={detail.totalAssists} icon={Icons.handshake} />
                  <StatCell label="Blocks" value={detail.totalBlocks} icon={Icons.block} />
                  <StatCell label="Sprints" value={detail.totalSprints} icon={Icons.sprint} />
                  <StatCell label="Clean Sheet Periods" value={detail.totalCleanSheets} icon={Icons.cleansheet} />
                  <StatCell label="Games" value={detail.gamesPlayed} icon={Icons.games} />
                  <StatCell label="Minutes" value={detail.totalMinutes} icon={Icons.clock} />
                  <StatCell label="Red Cards" value={detail.totalReds} icon={Icons.redCard} danger={detail.totalReds > 0} />
                </>
              )}
            </View>
          </View>

          {/* GW Form Strip */}
          {detail.formHistory.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Image source={Icons.graph} style={styles.sectionTitleIcon} />
                <Text style={styles.sectionTitle}>Recent Form</Text>
              </View>
              <View style={styles.formStrip}>
                {detail.formHistory.map((gw, i) => (
                  <View key={i} style={styles.formItem}>
                    <View style={[styles.formCircle, { backgroundColor: getFormColor(gw.points) }]}>
                      <Text style={styles.formCircleText}>{gw.points}</Text>
                    </View>
                    {gw.roundNumber != null && (
                      <Text style={styles.formLabel}>GW{gw.roundNumber}</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Recent Match Log */}
          {detail.recentMatches.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Image source={Icons.calendar} style={styles.sectionTitleIcon} />
                <Text style={styles.sectionTitle}>Recent Matches</Text>
              </View>
              {detail.recentMatches.map((match, i) => {
                const opp = formatMatchOpponent(match);
                return (
                  <View key={i} style={styles.matchRow}>
                    <View style={styles.matchLeft}>
                      <Text style={styles.matchRound}>{opp.round}</Text>
                      <Text style={styles.matchLabel} numberOfLines={1}>
                        {opp.label}
                      </Text>
                    </View>
                    <View style={styles.matchStats}>
                      {isGK ? (
                        <>
                          {match.saves > 0 && <MatchStat label="Saves" value={match.saves} />}
                          {match.goals > 0 && <MatchStat label="Goals" value={match.goals} />}
                        </>
                      ) : (
                        <>
                          {match.goals > 0 && <MatchStat label="Goals" value={match.goals} />}
                          {match.assists > 0 && <MatchStat label="Ass" value={match.assists} />}
                        </>
                      )}
                      {match.blocks > 0 && <MatchStat label="Blc" value={match.blocks} />}
                      {match.sprints > 0 && <MatchStat label="Spr" value={match.sprints} />}
                      {match.cleanSheets > 0 && (
                        <Text style={styles.cardIcon}>🧱×{match.cleanSheets}</Text>
                      )}
                      {match.yellowCards > 0 && (
                        <Text style={styles.cardIcon}>🟨</Text>
                      )}
                      {match.redCards > 0 && (
                        <Text style={styles.cardIcon}>🟥</Text>
                      )}
                    </View>
                    <View style={[
                      styles.matchPointsBadge,
                      match.pointsEarned >= 8 && styles.matchPointsHigh,
                      match.pointsEarned >= 4 && match.pointsEarned < 8 && styles.matchPointsMid,
                    ]}>
                      <Text style={styles.matchPointsText}>{match.pointsEarned}</Text>
                      <Text style={styles.matchPointsLabel}>pts</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Image source={Icons.calendar} style={styles.sectionTitleIcon} />
                <Text style={styles.sectionTitle}>Recent Matches</Text>
              </View>
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>No match data available yet</Text>
              </View>
            </View>
          )}
        </>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

function StatCell({ label, value, emoji, icon, accent, danger, highlight }) {
  return (
    <View style={[
      styles.statCell,
      accent && styles.statCellAccent,
      danger && styles.statCellDanger,
      highlight && styles.statCellHighlight,
    ]}>
      {icon
        ? <Image source={icon} style={styles.statCellIcon} />
        : <Text style={styles.statCellEmoji}>{emoji}</Text>
      }
      <Text style={[
        styles.statCellValue,
        danger && styles.statCellDangerText,
        highlight && styles.statCellHighlightText,
      ]}>
        {value}
      </Text>
      <Text style={styles.statCellLabel}>{label}</Text>
    </View>
  );
}

function MatchStat({ label, value }) {
  return (
    <View style={styles.matchStatPill}>
      <Text style={styles.matchStatText}>{value} {label}</Text>
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
    paddingTop: 56,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
  headerBody: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  positionEmoji: {
    width: 64,
    height: 64,
    marginBottom: spacing.sm,
    resizeMode: 'contain',
  },
  playerName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 4,
  },
  playerTeam: {
    fontSize: 16,
    color: colors.oceanBright,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  headerBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  positionBadge: {
    backgroundColor: colors.oceanBright + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.oceanBright,
  },
  positionBadgeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.large,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  headerStatItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  headerStatValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.white,
  },
  headerStatLabel: {
    fontSize: 11,
    color: colors.oceanBright,
    fontWeight: '600',
    marginTop: 2,
  },
  headerStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  errorContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.oceanMedium,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.medium,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  section: {
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: colors.pearl,
    borderRadius: borderRadius.large,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.sand + '50',
    ...shadows.small,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  sectionTitleIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCell: {
    backgroundColor: colors.pearl,
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    alignItems: 'center',
    flex: 1,
    minWidth: '30%',
    ...shadows.small,
    borderWidth: 1,
    borderColor: colors.sand + '40',
  },
  statCellAccent: {
    borderColor: colors.sand,
    backgroundColor: colors.sand + '10',
  },
  statCellDanger: {
    borderColor: colors.coral + '80',
    backgroundColor: colors.coral + '10',
  },
  statCellHighlight: {
    borderColor: colors.sand + '80',
    backgroundColor: colors.sand + '18',
  },
  statCellEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  statCellIcon: {
    width: 28,
    height: 28,
    marginBottom: 4,
    resizeMode: 'contain',
  },
  statCellValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.oceanDeep,
  },
  statCellDangerText: {
    color: colors.error,
  },
  statCellHighlightText: {
    color: colors.oceanDeep,
  },
  statCellLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  formStrip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.pearl,
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.small,
    justifyContent: 'space-around',
  },
  formItem: {
    alignItems: 'center',
    gap: 4,
  },
  formCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  formCircleText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.white,
  },
  formLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pearl,
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
    borderWidth: 1,
    borderColor: colors.sand + '40',
    borderLeftWidth: 4,
    borderLeftColor: colors.sand,
  },
  matchLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  matchRound: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.oceanMedium,
    marginBottom: 2,
  },
  matchLabel: {
    fontSize: 13,
    color: colors.textDark,
    fontWeight: '500',
  },
  matchStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: spacing.sm,
  },
  matchStatPill: {
    backgroundColor: colors.oceanBright + '25',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
  },
  matchStatText: {
    fontSize: 12,
    color: colors.oceanDeep,
    fontWeight: '700',
  },
  cardIcon: {
    fontSize: 16,
  },
  matchPointsBadge: {
    backgroundColor: colors.textMuted + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.small,
    alignItems: 'center',
    minWidth: 40,
  },
  matchPointsHigh: {
    backgroundColor: colors.success + '25',
  },
  matchPointsMid: {
    backgroundColor: colors.warning + '25',
  },
  matchPointsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  matchPointsLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  emptySection: {
    backgroundColor: colors.pearl,
    borderRadius: borderRadius.medium,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.small,
  },
  emptySectionText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  bottomPad: {
    height: spacing.xl,
  },
});
