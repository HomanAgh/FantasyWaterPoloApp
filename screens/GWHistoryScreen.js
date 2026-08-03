import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import { fetchAllRounds } from '../services/roundService';
import {
  getSnapshotRoundIds,
  getGwPicksForRound,
  getDeductionForRound,
} from '../services/userGwPicksService';
import { getMultiplePlayersPointsForRound } from '../services/playerRoundPointsService';
import supabase from '../config/supabaseClient';

export default function GWHistoryScreen({ navigation }) {
  const { userId } = useAuth();

  const [rounds, setRounds] = useState([]);           // all rounds user has snapshots for
  const [selectedRoundId, setSelectedRoundId] = useState(null);
  const [gwData, setGwData] = useState(null);         // { starters, bench, gwScore, deduction, net }
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [loadingGw, setLoadingGw] = useState(false);

  // ----- initial load: fetch rounds that have a snapshot -----
  useEffect(() => {
    if (!userId) return;
    loadRounds();
  }, [userId]);

  const loadRounds = async () => {
    setLoadingRounds(true);
    const [{ data: snapshotIds }, { data: allRounds }] = await Promise.all([
      getSnapshotRoundIds(userId),
      fetchAllRounds(),
    ]);

    if (allRounds && snapshotIds) {
      const snapshotSet = new Set(snapshotIds);
      const playedRounds = allRounds.filter(r => snapshotSet.has(r.id));
      setRounds(playedRounds);

      // Default to the most recent completed GW
      if (playedRounds.length > 0) {
        const latest = playedRounds[playedRounds.length - 1];
        setSelectedRoundId(latest.id);
      }
    }
    setLoadingRounds(false);
  };

  // ----- load squad + points when selected round changes -----
  useEffect(() => {
    if (!selectedRoundId || !userId) return;
    loadGwDetail(selectedRoundId);
  }, [selectedRoundId, userId]);

  const loadGwDetail = useCallback(async (roundId) => {
    setLoadingGw(true);
    setGwData(null);

    // Fetch picks, deduction, and player details in parallel
    const [{ data: picks }, deduction] = await Promise.all([
      getGwPicksForRound(userId, roundId),
      getDeductionForRound(userId, roundId),
    ]);

    if (!picks || picks.length === 0) {
      setGwData({ starters: [], bench: [], gwScore: 0, deduction: 0, net: 0 });
      setLoadingGw(false);
      return;
    }

    const allPlayerIds = picks.map(p => p.player_id);

    // Batch-fetch player info and GW points
    const [{ data: pointsMap }, { data: playerRows }] = await Promise.all([
      getMultiplePlayersPointsForRound(allPlayerIds, roundId),
      fetchPlayersByIds(allPlayerIds),
    ]);

    const playerInfoMap = {};
    (playerRows || []).forEach(p => { playerInfoMap[p.id] = p; });

    const enriched = picks.map(pick => {
      const info = playerInfoMap[pick.player_id] || {};
      const rawPts = pointsMap[pick.player_id] ?? 0;
      const displayPts = pick.is_captain ? rawPts * 2 : rawPts;
      return {
        playerId: pick.player_id,
        name: info.name || 'Unknown',
        position: info.position || '—',
        team: info.teams?.name || '—',
        isStarter: pick.is_starter,
        isCaptain: pick.is_captain,
        rawPoints: rawPts,
        displayPoints: displayPts,
      };
    });

    const starters = enriched
      .filter(p => p.isStarter)
      .sort((a, b) => {
        if (a.position === 'GK' && b.position !== 'GK') return -1;
        if (a.position !== 'GK' && b.position === 'GK') return 1;
        return b.displayPoints - a.displayPoints;
      });

    const bench = enriched
      .filter(p => !p.isStarter)
      .sort((a, b) => {
        if (a.position === 'GK' && b.position !== 'GK') return -1;
        if (a.position !== 'GK' && b.position === 'GK') return 1;
        return b.rawPoints - a.rawPoints;
      });

    const gwScore = starters.reduce((sum, p) => sum + p.displayPoints, 0);
    const net = Math.max(0, gwScore - deduction);

    setGwData({ starters, bench, gwScore, deduction, net });
    setLoadingGw(false);
  }, [userId]);

  // ----- helper: batch fetch player info -----
  const fetchPlayersByIds = async (ids) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, position, teams(name)')
        .in('id', ids);
      if (error) throw error;
      return { data: data || [] };
    } catch {
      return { data: [] };
    }
  };

  // ----- season summary row -----
  const seasonTotal = gwData
    ? null // will be derived from rounds list
    : null;

  if (loadingRounds) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.oceanBright} />
        <Text style={styles.loadingText}>Loading history…</Text>
      </View>
    );
  }

  if (rounds.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyTitle}>No history yet</Text>
        <Text style={styles.emptySubtext}>
          Your gameweek scores will appear here once your first gameweek is complete.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selectedRound = rounds.find(r => r.id === selectedRoundId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>GW History</Text>
          {selectedRound && (
            <Text style={styles.headerSub}>Gameweek {selectedRound.round_number}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Round selector tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}>
          {rounds.map(r => {
            const active = r.id === selectedRoundId;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setSelectedRoundId(r.id)}
                activeOpacity={0.8}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  GW{r.round_number}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* GW content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
        {loadingGw ? (
          <View style={styles.centeredInner}>
            <ActivityIndicator size="large" color={colors.oceanBright} />
            <Text style={styles.loadingText}>Loading GW{selectedRound?.round_number}…</Text>
          </View>
        ) : gwData ? (
          <>
            {/* Score summary card */}
            <View style={styles.scoreCard}>
              <View style={styles.scoreRow}>
                <View style={styles.scoreBlock}>
                  <Text style={styles.scoreLabel}>GW POINTS</Text>
                  <Text style={styles.scoreValue}>{gwData.gwScore}</Text>
                </View>
                {gwData.deduction > 0 && (
                  <>
                    <View style={styles.scoreDivider} />
                    <View style={styles.scoreBlock}>
                      <Text style={styles.scoreLabel}>TRANSFER HIT</Text>
                      <Text style={[styles.scoreValue, styles.scoreDeduction]}>
                        -{gwData.deduction}
                      </Text>
                    </View>
                    <View style={styles.scoreDivider} />
                    <View style={styles.scoreBlock}>
                      <Text style={styles.scoreLabel}>NET SCORE</Text>
                      <Text style={[styles.scoreValue, styles.scoreNet]}>{gwData.net}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Starters */}
            <Text style={styles.sectionTitle}>Starting XI</Text>
            {gwData.starters.map(player => (
              <PlayerRow key={player.playerId} player={player} isStarter />
            ))}

            {/* Bench */}
            {gwData.bench.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, styles.sectionBench]}>Bench</Text>
                {gwData.bench.map(player => (
                  <PlayerRow key={player.playerId} player={player} isStarter={false} />
                ))}
              </>
            )}

            {/* Legend */}
            <View style={styles.legend}>
              <Text style={styles.legendText}>(C) = Captain — points doubled</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function PlayerRow({ player, isStarter }) {
  const posColor = player.position === 'GK' ? colors.sand : colors.oceanBright;

  return (
    <View style={[styles.playerRow, !isStarter && styles.playerRowBench]}>
      {/* Position badge */}
      <View style={[styles.posBadge, { backgroundColor: posColor + '25', borderColor: posColor }]}>
        <Text style={[styles.posText, { color: posColor }]}>
          {player.position === 'GK' ? 'GK' : 'FP'}
        </Text>
      </View>

      {/* Name + team */}
      <View style={styles.playerInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.playerName, !isStarter && styles.playerNameBench]}>
            {player.name}
          </Text>
          {player.isCaptain && (
            <View style={styles.captainBadge}>
              <Text style={styles.captainText}>C</Text>
            </View>
          )}
        </View>
        <Text style={styles.playerTeam}>{player.team}</Text>
      </View>

      {/* Points */}
      <View style={styles.pointsContainer}>
        {!isStarter ? (
          <Text style={styles.benchPoints}>{player.rawPoints} pts</Text>
        ) : (
          <>
            <Text style={styles.playerPoints}>{player.displayPoints}</Text>
            {player.isCaptain && player.rawPoints > 0 && (
              <Text style={styles.captainNote}>({player.rawPoints}×2)</Text>
            )}
          </>
        )}
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
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.medium,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 26,
    color: colors.white,
    fontWeight: '300',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  headerSub: {
    fontSize: 13,
    color: colors.oceanBright,
    fontWeight: '500',
    marginTop: 2,
  },
  tabsWrapper: {
    backgroundColor: colors.oceanMedium,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '40',
  },
  tabsScroll: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.oceanBright + '60',
    marginRight: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.sand,
    borderColor: colors.sand,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.oceanBright,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: colors.oceanDeep,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  scoreCard: {
    backgroundColor: colors.oceanDeep,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.medium,
    borderWidth: 2,
    borderColor: colors.sand + '60',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  scoreBlock: {
    flex: 1,
    alignItems: 'center',
  },
  scoreDivider: {
    width: 1,
    height: 56,
    backgroundColor: colors.sand + '30',
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.sand,
  },
  scoreDeduction: {
    color: colors.coral,
    fontSize: 40,
  },
  scoreNet: {
    color: '#4ADE80',
    fontSize: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.oceanDeep,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.sand,
    paddingLeft: 8,
  },
  sectionBench: {
    borderLeftColor: colors.oceanBright,
    marginTop: spacing.lg,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.small,
    borderWidth: 1,
    borderColor: colors.seafoam,
  },
  playerRowBench: {
    backgroundColor: colors.backgroundWhite,
    opacity: 0.8,
  },
  posBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.small,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  posText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  playerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
    flexShrink: 1,
  },
  playerNameBench: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  captainBadge: {
    backgroundColor: colors.sand,
    width: 20,
    height: 20,
    borderRadius: borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captainText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.oceanDeep,
  },
  playerTeam: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  pointsContainer: {
    alignItems: 'flex-end',
    minWidth: 56,
  },
  playerPoints: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.oceanDeep,
  },
  captainNote: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
  benchPoints: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  legend: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  legendText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.backgroundLight,
  },
  centeredInner: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  backButton: {
    backgroundColor: colors.oceanMedium,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  white: {
    backgroundColor: colors.white,
  },
});
