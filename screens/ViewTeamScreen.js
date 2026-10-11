import React, { useState, useEffect, useCallback } from 'react';
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
import PitchView from '../components/PitchView';
import { fetchAllRounds } from '../services/roundService';
import {
  getPublicSnapshotRoundIds,
  getPublicGwPicksForRound,
  getPublicDeductionForRound,
  scorePicksWithAutoSub,
} from '../services/userGwPicksService';
import supabase from '../config/supabaseClient';

/**
 * Read-only pitch view of another manager's (or your own) locked GW squad.
 * Route params: { userId, teamName }
 */
export default function ViewTeamScreen({ route, navigation }) {
  const { userId: targetUserId, teamName } = route.params || {};

  const [rounds, setRounds] = useState([]);
  const [selectedGwId, setSelectedGwId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [captainId, setCaptainId] = useState(null);
  const [gwScore, setGwScore] = useState(0);
  const [deduction, setDeduction] = useState(0);
  const [historyRound, setHistoryRound] = useState(null);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [loadingGw, setLoadingGw] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!targetUserId) {
      setError('Missing team');
      setLoadingRounds(false);
      return;
    }
    loadRounds();
  }, [targetUserId]);

  const loadRounds = async () => {
    setLoadingRounds(true);
    setError(null);

    const [{ data: snapshotIds, error: snapError }, { data: allRounds }] =
      await Promise.all([
        getPublicSnapshotRoundIds(targetUserId),
        fetchAllRounds(),
      ]);

    if (snapError) {
      setError('Could not load this team');
      setRounds([]);
      setLoadingRounds(false);
      return;
    }

    if (allRounds && snapshotIds) {
      const snapshotSet = new Set(snapshotIds);
      const played = allRounds.filter(r => snapshotSet.has(r.id));
      setRounds(played);

      if (played.length > 0) {
        setSelectedGwId(played[played.length - 1].id);
      }
    }

    setLoadingRounds(false);
  };

  useEffect(() => {
    if (!selectedGwId || !targetUserId) return;
    loadHistoryForRound(selectedGwId);
  }, [selectedGwId, targetUserId]);

  const loadHistoryForRound = useCallback(
    async roundId => {
      setLoadingGw(true);
      const round = rounds.find(r => r.id === roundId);
      setHistoryRound(round || null);

      const [{ data: picks }, roundDeduction] = await Promise.all([
        getPublicGwPicksForRound(targetUserId, roundId),
        getPublicDeductionForRound(targetUserId, roundId),
      ]);
      setDeduction(roundDeduction);

      if (!picks || picks.length === 0) {
        setPlayers([]);
        setCaptainId(null);
        setGwScore(0);
        setLoadingGw(false);
        return;
      }

      const allPlayerIds = picks.map(p => p.player_id);
      const [{ data: playerRows }, scored] = await Promise.all([
        fetchPlayersByIds(allPlayerIds),
        scorePicksWithAutoSub(picks, roundId),
      ]);

      const playerInfoMap = {};
      (playerRows || []).forEach(p => {
        playerInfoMap[p.id] = p;
      });

      const captain = picks.find(p => p.is_captain);
      setCaptainId(captain?.player_id || null);

      const slotByStarter = {};
      (scored.slots || []).forEach(slot => {
        slotByStarter[slot.starterId] = slot;
      });
      const usedBenchIds = scored.usedBenchIds || new Set();

      // Show each player's own GW points on the card (not slot-after-auto-sub).
      // GW total still includes auto-subs; SUB/IN badges explain the swap.
      const enriched = picks.map(pick => {
        const info = playerInfoMap[pick.player_id] || {};
        const slot = slotByStarter[pick.player_id];
        const ownPoints = scored.pointsMap?.[pick.player_id] ?? 0;
        return {
          id: pick.player_id,
          name: info.name || 'Unknown',
          position: info.position || 'Outfield',
          team: info.teams?.name || '—',
          price: info.price ? parseFloat(info.price) : 0,
          isStarter: pick.is_starter,
          isCaptain: pick.is_captain,
          points: ownPoints,
          totalPoints: info.points_total ?? 0,
          positionOrder: pick.position_order ?? 0,
          wasAutoSub: !!slot?.wasAutoSub,
          autoSubFromId: slot?.wasAutoSub ? slot.usedPlayerId : null,
          autoSubbedIn: usedBenchIds.has(pick.player_id),
        };
      });

      setPlayers(enriched);
      setGwScore(scored.total || 0);
      setLoadingGw(false);
    },
    [targetUserId, rounds]
  );

  const fetchPlayersByIds = async ids => {
    try {
      const { data, error: fetchError } = await supabase
        .from('players')
        .select('id, name, position, price, points_total, teams(name)')
        .in('id', ids);
      if (fetchError) throw fetchError;
      return { data: data || [] };
    } catch {
      return { data: [] };
    }
  };

  const title = (teamName || 'TEAM').toUpperCase();

  if (loadingRounds) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>‹ BACK</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.auth.neon} />
          <Text style={styles.loadingText}>LOADING TEAM...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>‹ BACK</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <View style={styles.centered}>
          <Image source={Icons.warning} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>{error.toUpperCase()}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadRounds}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (rounds.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>‹ BACK</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>NO GAMEWEEKS YET</Text>
          <Text style={styles.emptySubtext}>
            This manager hasn&apos;t locked a squad{'\n'}for any gameweek yet.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>‹ BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.subtitle}>GW HISTORY</Text>
      </View>

      <View style={styles.gwPickerWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gwPickerScroll}
        >
          {rounds.map(r => {
            const active = r.id === selectedGwId;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.gwTab, active && styles.gwTabActive]}
                onPress={() => setSelectedGwId(r.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.gwTabText, active && styles.gwTabTextActive]}
                >
                  GW{r.round_number}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.historyStatsWrapper}>
        <View style={styles.statsRow}>
          <View style={[styles.statBadge, styles.historyStatBadge]}>
            <Text style={styles.statLabel}>
              GW {historyRound?.round_number ?? '—'}
            </Text>
            <Text style={styles.statValue}>{gwScore}</Text>
          </View>
          {deduction > 0 && (
            <View style={[styles.statBadge, styles.historyStatBadge]}>
              <Text style={styles.statLabel}>HIT</Text>
              <Text style={[styles.statValue, styles.statValueHit]}>
                -{deduction}
              </Text>
            </View>
          )}
        </View>
      </View>

      {loadingGw ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.auth.neon} />
          <Text style={styles.loadingText}>
            Loading GW{historyRound?.round_number}…
          </Text>
        </View>
      ) : players.length > 0 ? (
        <PitchView
          players={players}
          captainId={captainId}
          mode="pickTeam"
          isLocked
        />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptySubtext}>No squad snapshot for this GW.</Text>
        </View>
      )}
    </View>
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
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backButtonText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 16,
    color: colors.auth.neon,
    letterSpacing: 1,
  },
  title: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 36,
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 14,
    color: colors.auth.placeholder,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  gwPickerWrapper: {
    backgroundColor: 'transparent',
    marginBottom: spacing.sm,
  },
  gwPickerScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.md,
  },
  gwTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.round,
    backgroundColor: colors.auth.inputBg,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  gwTabActive: {
    backgroundColor: colors.auth.glass,
    borderColor: colors.auth.neon,
    shadowColor: colors.auth.neon,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  gwTabText: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 24,
    color: colors.white,
    letterSpacing: 0.5,
  },
  gwTabTextActive: {
    color: colors.white,
  },
  historyStatsWrapper: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  statBadge: {
    flex: 1,
    backgroundColor: colors.auth.glass,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    alignItems: 'center',
    minHeight: 72,
    justifyContent: 'center',
  },
  historyStatBadge: {
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  statLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 18,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    marginBottom: -2,
  },
  statValue: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 28,
    color: colors.auth.statValue,
  },
  statValueHit: {
    color: colors.coral,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: fonts.barlowCondensedRegular,
    color: colors.auth.placeholder,
    fontSize: 14,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
    marginBottom: spacing.md,
    opacity: 0.9,
  },
  emptyTitle: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 22,
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 14,
    color: colors.auth.placeholder,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
});
