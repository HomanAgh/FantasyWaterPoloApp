import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';
import { useTeam } from '../context/TeamContext';
import { useRound } from '../context/RoundContext';
import { useAuth } from '../context/AuthContext';
import PitchView from '../components/PitchView';
import * as playerRoundPointsService from '../services/playerRoundPointsService';
import { fetchAllRounds } from '../services/roundService';
import {
  getSnapshotRoundIds,
  getGwPicksForRound,
  getDeductionForRound,
  scorePicksWithAutoSub,
} from '../services/userGwPicksService';
import {
  fetchAppearanceMap,
  picksFromSelectedPlayers,
  resolveSquadPointsWithAutoSub,
} from '../services/autoSubstitutionService';
import supabase from '../config/supabaseClient';

export default function MyTeamScreen({ navigation }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [enrichedPlayers, setEnrichedPlayers] = useState([]);
  const [liveGameweekPoints, setLiveGameweekPoints] = useState(0);

  // GW history state
  const [selectedGwId, setSelectedGwId] = useState(null); // null = current GW
  const [pastRounds, setPastRounds] = useState([]);
  const [historyPlayers, setHistoryPlayers] = useState([]);
  const [historyCaptainId, setHistoryCaptainId] = useState(null);
  const [historyGwScore, setHistoryGwScore] = useState(0);
  const [historyDeduction, setHistoryDeduction] = useState(0);
  const [historyRound, setHistoryRound] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isHistoryMode = selectedGwId !== null;

  // Context
  const {
    selectedPlayers,
    setPlayerAsStarter,
    swapPlayers,
    remainingBudget,
    totalSpent,
    captainId,
    setCaptain,
    totalPoints,
    startersCount,
    goalkeepersCount,
    outfieldCount,
    isTeamValid,
    teamName,
    isLoading: isTeamLoading,
    teamLoadError,
    loadUserTeam,
    MAX_PLAYERS,
    MAX_OUTFIELD,
  } = useTeam();

  const { userId } = useAuth();
  const { currentRound, isLocked } = useRound();

  // ── Current GW: enrich players with round points ──
  useEffect(() => {
    const loadGameweekPoints = async () => {
      if (!currentRound || selectedPlayers.length === 0) {
        setEnrichedPlayers(selectedPlayers);
        setLiveGameweekPoints(0);
        return;
      }
      const playerIds = selectedPlayers.map(p => p.id);
      const [{ data: pointsMap }, appearanceMap] = await Promise.all([
        playerRoundPointsService.getMultiplePlayersPointsForRound(playerIds, currentRound.id),
        fetchAppearanceMap(playerIds, currentRound.id),
      ]);
      const picks = picksFromSelectedPlayers(selectedPlayers, captainId);
      const { total, slots, usedBenchIds } = resolveSquadPointsWithAutoSub(
        picks,
        appearanceMap,
        pointsMap || {}
      );
      const slotByStarter = {};
      (slots || []).forEach(slot => {
        slotByStarter[slot.starterId] = slot;
      });
      const enriched = selectedPlayers.map(p => ({
        ...p,
        totalPoints: p.points ?? 0,
        points: pointsMap[p.id] || 0,
        wasAutoSub: !!slotByStarter[p.id]?.wasAutoSub,
        autoSubbedIn: usedBenchIds?.has(p.id) || false,
      }));
      setEnrichedPlayers(enriched);
      setLiveGameweekPoints(total);
    };
    loadGameweekPoints();
  }, [currentRound, selectedPlayers, captainId]);

  // ── Load past rounds for GW picker on mount ──
  useEffect(() => {
    if (!userId) return;
    loadPastRounds();
  }, [userId]);

  const loadPastRounds = async () => {
    const [{ data: snapshotIds }, { data: allRounds }] = await Promise.all([
      getSnapshotRoundIds(userId),
      fetchAllRounds(),
    ]);
    if (!allRounds || !snapshotIds) return;
    const snapshotSet = new Set(snapshotIds);
    const played = allRounds.filter(r => snapshotSet.has(r.id));
    setPastRounds(played);
  };

  // ── Load frozen squad when a past GW tab is selected ──
  useEffect(() => {
    if (!selectedGwId || !userId) return;
    loadHistoryForRound(selectedGwId);
  }, [selectedGwId, userId]);

  const loadHistoryForRound = useCallback(async (roundId) => {
    setLoadingHistory(true);
    const round = pastRounds.find(r => r.id === roundId);
    setHistoryRound(round || null);

    const [{ data: picks }, deduction] = await Promise.all([
      getGwPicksForRound(userId, roundId),
      getDeductionForRound(userId, roundId),
    ]);
    setHistoryDeduction(deduction);

    if (!picks || picks.length === 0) {
      setHistoryPlayers([]);
      setHistoryCaptainId(null);
      setHistoryGwScore(0);
      setLoadingHistory(false);
      return;
    }

    const allPlayerIds = picks.map(p => p.player_id);
    const [{ data: playerRows }, scored] = await Promise.all([
      fetchPlayersByIds(allPlayerIds),
      scorePicksWithAutoSub(picks, roundId),
    ]);

    const playerInfoMap = {};
    (playerRows || []).forEach(p => { playerInfoMap[p.id] = p; });

    const captain = picks.find(p => p.is_captain);
    setHistoryCaptainId(captain?.player_id || null);

    const slotByStarter = {};
    (scored.slots || []).forEach(slot => {
      slotByStarter[slot.starterId] = slot;
    });
    const usedBenchIds = scored.usedBenchIds || new Set();

    // Own GW points on cards; auto-sub only affects the GW total + SUB/IN badges.
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

    setHistoryPlayers(enriched);
    setHistoryGwScore(scored.total || 0);
    setLoadingHistory(false);
  }, [userId, pastRounds]);

  const fetchPlayersByIds = async (ids) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, position, price, points_total, teams(name)')
        .in('id', ids);
      if (error) throw error;
      return { data: data || [] };
    } catch {
      return { data: [] };
    }
  };

  // ── What to pass to PitchView ──
  const displayPlayers = isHistoryMode ? historyPlayers : enrichedPlayers;
  const displayCaptainId = isHistoryMode ? historyCaptainId : captainId;

  // ── Player modal handlers ──
  const handlePlayerPress = (playerId, player) => {
    setSelectedPlayer(player);
    setModalVisible(true);
  };

  const handleEmptySlotPress = () => {
    if (!isHistoryMode) navigation.navigate('Transfers');
  };

  const handleShowSwapModal = () => {
    setModalVisible(false);
    setSwapModalVisible(true);
  };

  const handleSwapWithPlayer = async (targetPlayerId) => {
    setSwapModalVisible(false);
    await swapPlayers(selectedPlayer.id, targetPlayerId);
    setSelectedPlayer(null);
  };

  const handleSetCaptain = async () => {
    setModalVisible(false);
    await setCaptain(selectedPlayer.id, isLocked);
    setSelectedPlayer(null);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedPlayer(null);
  };

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{(teamName || 'MY TEAM').toUpperCase()}</Text>

          {!isHistoryMode && (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statBadge}>
                  <Text style={styles.statLabel}>BUDGET</Text>
                  <Text style={styles.statValue}>${remainingBudget.toFixed(1)}M</Text>
                </View>
                <View style={styles.statBadge}>
                  <Text style={styles.statLabel}>POINTS</Text>
                  <Text style={styles.statValue}>{liveGameweekPoints}</Text>
                </View>
                <View style={[styles.statBadge, isTeamValid() && styles.statBadgeSuccess]}>
                  <Text style={styles.statLabel}>SQUAD</Text>
                  <Text style={styles.statValue}>{selectedPlayers.length}/{MAX_PLAYERS}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      {/* ── GW Picker ── */}
      {pastRounds.length > 0 && (
        <View style={styles.gwPickerWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gwPickerScroll}>
            <TouchableOpacity
              style={[styles.gwTab, !isHistoryMode && styles.gwTabActive]}
              onPress={() => setSelectedGwId(null)}
              activeOpacity={0.8}>
              <Text style={[styles.gwTabText, !isHistoryMode && styles.gwTabTextActive]}>
                CURRENT
              </Text>
            </TouchableOpacity>
            {pastRounds.map(r => {
              const active = r.id === selectedGwId;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.gwTab, active && styles.gwTabActive]}
                  onPress={() => setSelectedGwId(r.id)}
                  activeOpacity={0.8}>
                  <Text style={[styles.gwTabText, active && styles.gwTabTextActive]}>
                    GW{r.round_number}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── History GW score (below picker — tied to selected GW) ── */}
      {isHistoryMode && (
        <View style={styles.historyStatsWrapper}>
          <View style={styles.statsRow}>
            <View style={[styles.statBadge, styles.historyStatBadge]}>
              <Text style={styles.statLabel}>GW {historyRound?.round_number ?? '—'}</Text>
              <Text style={styles.statValue}>{historyGwScore}</Text>
            </View>
            {historyDeduction > 0 && (
              <View style={[styles.statBadge, styles.historyStatBadge]}>
                <Text style={styles.statLabel}>HIT</Text>
                <Text style={[styles.statValue, styles.statValueHit]}>-{historyDeduction}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Locked banner (current mode only) ── */}
      {!isHistoryMode && isLocked && currentRound && (
        <View style={styles.lockedBanner}>
          <Image source={Icons.locked} style={styles.lockedIcon} />
          <Text style={styles.lockedText}>
            Team Locked — Gameweek {currentRound.round_number} in progress
          </Text>
        </View>
      )}

      {/* ── Sync error (current mode only) ── */}
      {!isHistoryMode && teamLoadError && !isTeamLoading && (
        <View style={styles.syncErrorBanner}>
          <View style={styles.warningContent}>
            <Text style={styles.syncErrorTitle}>Couldn't sync team</Text>
            <Text style={styles.warningText}>{teamLoadError}</Text>
          </View>
          <TouchableOpacity
            style={styles.syncRetryButton}
            onPress={() => loadUserTeam()}
            activeOpacity={0.8}
          >
            <Text style={styles.syncRetryText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Syncing banner ── */}
      {!isHistoryMode && isTeamLoading && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" color={colors.auth.neon} />
          <Text style={styles.syncingText}>Syncing your team…</Text>
        </View>
      )}

      {/* ── Incomplete team nudge (current mode only; not during sync errors) ── */}
      {!isHistoryMode && !isTeamLoading && !teamLoadError && !isTeamValid() && selectedPlayers.length > 0 && (
        <View style={styles.warningBanner}>
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>
              {selectedPlayers.length < MAX_PLAYERS
                ? `Add ${MAX_PLAYERS - selectedPlayers.length} more to complete your squad`
                : 'Finish setting your squad'}
            </Text>
            <Text style={styles.warningText}>
              {goalkeepersCount < 2 && `Need ${2 - goalkeepersCount} more GK • `}
              {outfieldCount < MAX_OUTFIELD && `Need ${MAX_OUTFIELD - outfieldCount} more Outfield • `}
              {startersCount < 7 && selectedPlayers.length === MAX_PLAYERS && `Set ${7 - startersCount} more starters`}
            </Text>
          </View>
        </View>
      )}

      {/* ── Pitch ── */}
      {isHistoryMode && loadingHistory ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.auth.neon} />
          <Text style={styles.loadingText}>Loading GW{historyRound?.round_number}…</Text>
        </View>
      ) : displayPlayers.length > 0 ? (
        <PitchView
          players={displayPlayers}
          captainId={displayCaptainId}
          mode="pickTeam"
          onPlayerPress={handlePlayerPress}
          onEmptySlotPress={handleEmptySlotPress}
          isLocked={isHistoryMode || isLocked}
        />
      ) : !isHistoryMode ? (
        <ScrollView style={styles.emptyContainer} contentContainerStyle={styles.emptyContent}>
          <View style={styles.emptyCard}>
            <Image source={Icons.roboplayer} style={styles.emptyEmoji} />
            <Text style={styles.emptyTitle}>START BUILDING YOUR TEAM</Text>
            <Text style={styles.emptyText}>
              {`You have a budget of $100M\nto build a squad of ${MAX_PLAYERS} players.`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Players')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>ADD PLAYERS</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      {/* ── Player Action Modal ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseModal}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {selectedPlayer && (
              <>
                {/* Player info header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalPlayerInfo}>
                    <Image
                      source={
                        selectedPlayer.position === 'GK' ? Icons.goalie : Icons.player1
                      }
                      style={styles.modalPlayerEmoji}
                    />
                    <View>
                      <Text style={styles.modalPlayerName}>{selectedPlayer.name}</Text>
                      <Text style={styles.modalPlayerDetails}>
                        {selectedPlayer.team} • {selectedPlayer.position}
                        {!isHistoryMode && selectedPlayer.price
                          ? ` • $${selectedPlayer.price.toFixed(1)}M`
                          : ''}
                        {` • ${selectedPlayer.totalPoints ?? selectedPlayer.points ?? 0} pts`}
                      </Text>
                    </View>
                  </View>
                  {selectedPlayer.id === displayCaptainId && (
                    <View style={styles.modalCaptainBadge}>
                      <Text style={styles.modalCaptainText}>Captain</Text>
                    </View>
                  )}
                </View>

                {isHistoryMode ? (
                  /* History mode: show GW points only */
                  <View style={styles.modalActions}>
                    <View style={styles.historyPointsBox}>
                      <Text style={styles.historyPointsLabel}>
                        {selectedPlayer.id === historyCaptainId
                          ? 'GW Points (C ×2)'
                          : 'GW Points'}
                      </Text>
                      <Text style={styles.historyPointsValue}>
                        {selectedPlayer.id === historyCaptainId
                          ? (selectedPlayer.points || 0) * 2
                          : (selectedPlayer.points || 0)}
                      </Text>
                      {selectedPlayer.id === historyCaptainId && (selectedPlayer.points || 0) > 0 && (
                        <Text style={styles.historyPointsNote}>
                          ({selectedPlayer.points} × 2)
                        </Text>
                      )}
                      {selectedPlayer.wasAutoSub && (
                        <Text style={styles.historyBenchNote}>
                          Did not play — bench auto-sub counted in GW total
                        </Text>
                      )}
                      {!selectedPlayer.isStarter && (
                        <Text style={styles.historyBenchNote}>
                          {selectedPlayer.autoSubbedIn
                            ? 'Auto-subbed into XI (points in GW total)'
                            : 'Bench — did not count'}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={handleCloseModal}
                      activeOpacity={0.8}>
                      <Text style={styles.modalButtonTextCancel}>Close</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Current mode: full edit actions */
                  <View style={styles.modalActions}>
                    {selectedPlayer.isStarter && selectedPlayer.id !== captainId && (
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalButtonCaptain]}
                        onPress={handleSetCaptain}
                        activeOpacity={0.8}>
                        <Image source={Icons.trophy} style={styles.modalButtonIcon} />
                        <Text style={styles.modalButtonText}>Set as Captain</Text>
                        <Text style={styles.modalButtonSubtext}>2× Points</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonSwap]}
                      onPress={handleShowSwapModal}
                      activeOpacity={0.8}>
                      <Image source={Icons.swap} style={styles.modalButtonIcon} />
                      <Text style={styles.modalButtonText}>
                        {selectedPlayer.isStarter ? 'Swap with Substitute' : 'Swap with Starter'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={handleCloseModal}
                      activeOpacity={0.8}>
                      <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Swap Selection Modal (current mode only) ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={swapModalVisible && !isHistoryMode}
        onRequestClose={() => setSwapModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setSwapModalVisible(false);
            setSelectedPlayer(null);
          }}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {selectedPlayer && (
              <>
                <View style={styles.swapModalHeader}>
                  <Text style={styles.swapModalTitle}>Select player to swap with</Text>
                  <Text style={styles.swapModalSubtitle}>
                    {selectedPlayer.name} ({selectedPlayer.position})
                  </Text>
                </View>
                <ScrollView style={styles.swapPlayersList}>
                  {enrichedPlayers
                    .filter(p =>
                      p.id !== selectedPlayer.id &&
                      p.position === selectedPlayer.position &&
                      p.isStarter !== selectedPlayer.isStarter
                    )
                    .map(player => (
                      <TouchableOpacity
                        key={player.id}
                        style={styles.swapPlayerCard}
                        onPress={() => handleSwapWithPlayer(player.id)}
                        activeOpacity={0.7}>
                        <View style={styles.swapPlayerInfo}>
                          <Image
                            source={
                              player.position === 'GK' ? Icons.goalie : Icons.player1
                            }
                            style={styles.swapPlayerEmoji}
                          />
                          <View style={styles.swapPlayerDetails}>
                            <Text style={styles.swapPlayerName}>{player.name}</Text>
                            <Text style={styles.swapPlayerMeta}>
                              {player.team} • {player.points} pts
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.swapPlayerArrow}>→</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setSwapModalVisible(false);
                    setSelectedPlayer(null);
                  }}
                  activeOpacity={0.8}>
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

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
  },
  headerContent: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 42,
    color: colors.white,
    letterSpacing: 1,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: -spacing.sm,
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
  statBadgeSuccess: {
    borderColor: colors.success,
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
  historyStatsWrapper: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  historyStatBadge: {
    minHeight: 52,
    paddingVertical: spacing.sm,
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

  lockedBanner: {
    backgroundColor: colors.coral + '22',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  lockedIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  lockedText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.coral,
  },
  warningBanner: {
    backgroundColor: colors.auth.inputBg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.sand,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncErrorBanner: {
    backgroundColor: colors.auth.inputBg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.coral,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncErrorTitle: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 14,
    color: colors.coral,
    marginBottom: 2,
  },
  syncRetryButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  syncRetryText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 12,
    color: colors.auth.neon,
    letterSpacing: 1,
  },
  syncingBanner: {
    backgroundColor: colors.auth.inputBg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neonSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncingText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 14,
    color: colors.auth.placeholder,
  },
  warningIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 14,
    color: colors.sand,
    marginBottom: 2,
  },
  warningText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 12,
    color: colors.white,
  },

  loadingContainer: {
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

  emptyContainer: {
    flex: 1,
  },
  emptyContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyCard: {
    width: '100%',
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    padding: spacing.xs + 8,
    alignItems: 'center',
  },
  emptyEmoji: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    
    opacity: 0.9,
  },
  emptyTitle: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 24,
    color: '#7CB2FF',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 18,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyButton: {
    width: '100%',
    marginTop: spacing.lg,
    backgroundColor: colors.auth.buttonTop,
    paddingVertical: spacing.md + 4,
    borderRadius: borderRadius.round,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  emptyButtonText: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    color: colors.white,
    fontSize: 24,
    letterSpacing: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 11, 24, 0.72)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A1A2E',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    borderBottomWidth: 0,
    padding: spacing.xl,
    paddingBottom: spacing.xl + 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.auth.neonSoft,
  },
  modalPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  modalPlayerEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    resizeMode: 'cover',
  },
  modalPlayerName: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 24,
    color: colors.white,
    marginBottom: 4,
  },
  modalPlayerDetails: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.auth.placeholder,
  },
  modalCaptainBadge: {
    backgroundColor: colors.sand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  modalCaptainText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 12,
    color: colors.oceanDeep,
  },
  modalActions: {
    gap: spacing.md,
  },
  modalButton: {
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 0.5,
  },
  modalButtonCaptain: {
    backgroundColor: colors.sand + '22',
    borderColor: colors.sand,
  },
  modalButtonSwap: {
    backgroundColor: colors.auth.inputBg,
    borderColor: colors.auth.neon,
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderColor: colors.auth.placeholder,
  },
  modalButtonIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    tintColor: colors.white,
  },
  modalButtonText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 20,
    color: colors.white,
    flex: 1,
  },
  modalButtonSubtext: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 20,
    color: colors.sand,
  },
  modalButtonTextCancel: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 20,
    color: colors.auth.placeholder,
    textAlign: 'center',
    flex: 1,
  },

  historyPointsBox: {
    backgroundColor: colors.auth.inputBg,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  historyPointsLabel: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 11,
    color: colors.auth.neon,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  historyPointsValue: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 56,
    color: colors.sand,
  },
  historyPointsNote: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 13,
    color: colors.auth.placeholder,
    marginTop: 2,
  },
  historyBenchNote: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 12,
    color: colors.coral,
    marginTop: spacing.sm,
  },

  swapModalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.auth.neonSoft,
  },
  swapModalTitle: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 18,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  swapModalSubtitle: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 14,
    color: colors.auth.placeholder,
  },
  swapPlayersList: {
    maxHeight: 300,
    marginBottom: spacing.md,
  },
  swapPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.auth.inputBg,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.auth.neonSoft,
  },
  swapPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  swapPlayerEmoji: {
    width: 28,
    height: 28,
    marginRight: spacing.md,
    borderRadius: 14,
    resizeMode: 'cover',
  },
  swapPlayerDetails: {
    flex: 1,
  },
  swapPlayerName: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 16,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  swapPlayerMeta: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 12,
    color: colors.auth.placeholder,
  },
  swapPlayerArrow: {
    fontSize: 20,
    color: colors.auth.neon,
    fontWeight: 'bold',
  },
});

