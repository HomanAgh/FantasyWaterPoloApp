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

  const formatMatchOpponent = (match) => {
    if (!match?.fixture) return { label: 'Unknown', round: '', status: null };
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

  const displayName = detail?.name || playerPreview?.name || '...';
  const displayTeam = detail?.team || playerPreview?.team || '';
  const displayPrice = detail?.price ?? playerPreview?.price;
  const displayTotalPoints = detail?.totalPoints ?? playerPreview?.points ?? 0;
  const displayPtsPerGame = detail?.pointsPerGame ?? '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
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

        <Image
          source={isGK ? Icons.goalie : Icons.player1}
          style={styles.avatar}
        />
        <Text style={styles.playerName} numberOfLines={2}>
          {displayName.toUpperCase()}
        </Text>
        {!!displayTeam && (
          <Text style={styles.playerTeam}>{displayTeam.toUpperCase()}</Text>
        )}
        <View style={styles.positionBadge}>
          <Text style={styles.positionBadgeText}>
            {isGK ? 'GOALKEEPER' : 'FIELD PLAYER'}
          </Text>
        </View>
      </View>

      {/* ── Key metrics ── */}
      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>PRICE</Text>
          <Text style={styles.metricValue}>
            {displayPrice != null ? `$${Number(displayPrice).toFixed(1)}M` : '—'}
          </Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>TOTAL PTS</Text>
          <Text style={styles.metricValue}>{displayTotalPoints}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>PTS/GAME</Text>
          <Text style={styles.metricValue}>{displayPtsPerGame}</Text>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.auth.neon} />
          <Text style={styles.loadingText}>LOADING STATS...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.emptyCard}>
          <Image source={Icons.warning} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>{error.toUpperCase()}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDetail} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      )}

      {detail && !loading && (
        <>
          {/* ── Season Stats ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleInline}>SEASON STATS</Text>
            </View>
            <View style={styles.statsGrid}>
              {isGK ? (
                <>
                  <StatCell label="SAVES" value={detail.totalSaves} icon={Icons.handsave} />
                  <StatCell label="PEN SAVE" value={detail.totalPenaltySaves} icon={Icons.penaltysave} />
                  <StatCell label="CLEAN SHEET" value={detail.totalCleanSheets} icon={Icons.clean} />
                  <StatCell label="ASSISTS" value={detail.totalAssists} icon={Icons.handshake} />
                  <StatCell label="GOALS" value={detail.totalGoals} icon={Icons.goal} />
                  <StatCell label="STEALS" value={detail.totalSteals} icon={Icons.steals} />
                  <StatCell label="GAMES" value={detail.gamesPlayed} icon={Icons.miniball} />
                  <StatCell
                    label="RED CARD"
                    value={detail.totalReds}
                    icon={Icons.redCard}
                    danger={detail.totalReds > 0}
                  />
                </>
              ) : (
                <>
                  <StatCell label="GOALS" value={detail.totalGoals} icon={Icons.goal} />
                  <StatCell label="ASSISTS" value={detail.totalAssists} icon={Icons.handshake} />
                  <StatCell label="BLOCKS" value={detail.totalBlocks} icon={Icons.stopp} />
                  <StatCell label="SPRINTS" value={detail.totalSprints} icon={Icons.tinyswimmer} />
                  <StatCell label="STEALS" value={detail.totalSteals} icon={Icons.steals} />
                  <StatCell label="FOULS DRAWN" value={detail.totalFoulsDrawn} icon={Icons.whistle} />
                  <StatCell label="CLEAN SHEET" value={detail.totalCleanSheets} icon={Icons.clean} />
                  <StatCell label="GAMES" value={detail.gamesPlayed} icon={Icons.miniball} />
                  <StatCell
                    label="RED CARD"
                    value={detail.totalReds}
                    icon={Icons.redCard}
                    danger={detail.totalReds > 0}
                  />
                </>
              )}
            </View>
          </View>

          {/* ── Recent Form ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleInline}>RECENT FORM</Text>
              <Image source={Icons.graph} style={[styles.sectionHeaderIcon, styles.iconNeon]} />
            </View>

            <View style={styles.formStrip}>
              {(detail.formHistory?.length > 0
                ? detail.formHistory
                : [{ points: '0', roundNumber: 1 }, { points: '0', roundNumber: 2 }, { points: '0', roundNumber: 3 }]
              ).map((gw, i) => (
                <View key={i} style={styles.formItem}>
                  <View style={styles.formCircle}>
                    <Text style={styles.formCircleText}>{gw.points}</Text>
                  </View>
                  <Text style={styles.formLabel}>
                    GW{gw.roundNumber != null ? gw.roundNumber : i + 1}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Recent Matches ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleInline}>RECENT MATCHES</Text>
              <Image source={Icons.calendar} style={[styles.sectionHeaderIcon, styles.iconNeon]} />
            </View>

            {detail.recentMatches?.length > 0 ? (
              detail.recentMatches.map((match, i) => {
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
                          {match.saves > 0 && <MatchStat label="SVS" value={match.saves} />}
                          {match.penaltySaves > 0 && <MatchStat label="PS" value={match.penaltySaves} />}
                          {match.goals > 0 && <MatchStat label="GLS" value={match.goals} />}
                        </>
                      ) : (
                        <>
                          {match.goals > 0 && <MatchStat label="GLS" value={match.goals} />}
                          {match.assists > 0 && <MatchStat label="ASS" value={match.assists} />}
                        </>
                      )}
                      {match.blocks > 0 && !isGK && <MatchStat label="BLC" value={match.blocks} />}
                      {match.sprints > 0 && !isGK && <MatchStat label="SPR" value={match.sprints} />}
                      {match.steals > 0 && !isGK && <MatchStat label="STL" value={match.steals} />}
                      {match.foulsDrawn > 0 && <MatchStat label="PFD" value={match.foulsDrawn} />}
                      {match.cleanSheets > 0 && (
                        <MatchStat label="CS" value={match.cleanSheets} />
                      )}
                      {match.redCards > 0 && (
                        <Image source={Icons.redCard} style={styles.matchRedIcon} />
                      )}
                    </View>
                    <View style={styles.matchPointsBadge}>
                      <Text style={styles.matchPointsText}>{match.pointsEarned}</Text>
                      <Text style={styles.matchPointsLabel}>PTS</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyMatches}>
                <Image source={Icons.bigcalender} style={styles.emptyMatchesIcon} />
                <Text style={styles.emptyMatchesText}>NO MATCH DATA AVAILABLE YET</Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function StatCell({ label, value, icon, danger }) {
  return (
    <View style={[styles.statCell, danger && styles.statCellDanger]}>
      <Image
        source={icon}
        style={[styles.statCellIcon, styles.iconStat, danger && styles.iconDanger]}
      />
      <Text style={[styles.statCellValue, danger && styles.statCellDangerText]}>
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
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: spacing.md,
    resizeMode: 'contain',
  },
  playerName: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 42,
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 4,
  },
  playerTeam: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  positionBadge: {
    borderWidth: 0.5,
    borderColor: colors.sand,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: colors.auth.inputBg,
  },
  positionBadgeText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 16,
    color: colors.sand,
    letterSpacing: 1,
  },

  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  metricBox: {
    flex: 1,
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    minHeight: 72,
    justifyContent: 'center',
  },
  metricLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 28,
    color: colors.white,
  },

  iconStat: {
    tintColor: colors.auth.statLabel,
  },
  iconNeon: {
    tintColor: colors.auth.neon,
  },
  iconDanger: {
    tintColor: colors.coral,
  },

  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 14,
    color: colors.auth.statLabel,
    letterSpacing: 1,
  },

  emptyCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 16,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
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

  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.auth.neon,
  },
  sectionTitleInline: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 0.5,
  },
  sectionHeaderIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCell: {
    width: '23%',
    flexGrow: 1,
    minWidth: '20%',
    backgroundColor: colors.auth.inputBg,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  statCellDanger: {
    borderColor: colors.coral,
  },
  statCellIcon: {
    width: 22,
    height: 22,
    marginBottom: 4,
    resizeMode: 'contain',
  },
  statCellValue: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 22,
    color: colors.white,
  },
  statCellDangerText: {
    color: colors.coral,
  },
  statCellLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 10,
    color: colors.auth.statLabel,
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },

  formStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  formItem: {
    alignItems: 'center',
    gap: 10,
  },
  formCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3.5,
    borderColor: colors.auth.statLabel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCircleText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 36,
    color: colors.white,
    lineHeight: 40,
  },
  formLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 13,
    color: colors.auth.statLabel,
    letterSpacing: 0.5,
  },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.auth.neonSoft,
  },
  matchLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  matchRound: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 12,
    color: colors.auth.neon,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  matchLabel: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 14,
    color: colors.white,
  },
  matchStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: spacing.sm,
  },
  matchStatPill: {
    backgroundColor: colors.auth.inputBg,
    borderWidth: 0.5,
    borderColor: colors.auth.neonSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.small,
  },
  matchStatText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 11,
    color: colors.auth.statLabel,
  },
  matchRedIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  matchPointsBadge: {
    backgroundColor: colors.auth.inputBg,
    borderWidth: 0.5,
    borderColor: colors.sand,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.small,
    alignItems: 'center',
    minWidth: 42,
  },
  matchPointsText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 16,
    color: colors.sand,
  },
  matchPointsLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 9,
    color: colors.auth.statLabel,
    letterSpacing: 0.5,
  },

  emptyMatches: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyMatchesIcon: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: spacing.lg,
  },
  emptyMatchesText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 18,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    textAlign: 'center',
  },
});
