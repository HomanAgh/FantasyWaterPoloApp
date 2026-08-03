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
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
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
} from '../services/userGwPicksService';
import supabase from '../config/supabaseClient';

export default function MyTeamScreen({ navigation }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [enrichedPlayers, setEnrichedPlayers] = useState([]);

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
    reorderOutfieldSubs,
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
  } = useTeam();

  const { userId } = useAuth();
  const { currentRound, isLocked, timeToDeadline, formatDeadline } = useRound();

  // ── Current GW: enrich players with round points ──
  useEffect(() => {
    const loadGameweekPoints = async () => {
      if (!currentRound || selectedPlayers.length === 0) {
        setEnrichedPlayers(selectedPlayers);
        return;
      }
      const playerIds = selectedPlayers.map(p => p.id);
      const { data: pointsMap } = await playerRoundPointsService
        .getMultiplePlayersPointsForRound(playerIds, currentRound.id);
      const enriched = selectedPlayers.map(p => ({
        ...p,
        points: pointsMap[p.id] || 0,
      }));
      setEnrichedPlayers(enriched);
    };
    loadGameweekPoints();
  }, [currentRound, selectedPlayers]);

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
    const [{ data: pointsMap }, { data: playerRows }] = await Promise.all([
      playerRoundPointsService.getMultiplePlayersPointsForRound(allPlayerIds, roundId),
      fetchPlayersByIds(allPlayerIds),
    ]);

    const playerInfoMap = {};
    (playerRows || []).forEach(p => { playerInfoMap[p.id] = p; });

    const captain = picks.find(p => p.is_captain);
    setHistoryCaptainId(captain?.player_id || null);

    const enriched = picks.map(pick => {
      const info = playerInfoMap[pick.player_id] || {};
      return {
        id: pick.player_id,
        name: info.name || 'Unknown',
        position: info.position || 'Outfield',
        team: info.teams?.name || '—',
        price: info.price ? parseFloat(info.price) : 0,
        isStarter: pick.is_starter,
        isCaptain: pick.is_captain,
        points: pointsMap[pick.player_id] ?? 0,
        positionOrder: 0,
      };
    });

    const gwScore = enriched
      .filter(p => p.isStarter)
      .reduce((sum, p) => sum + (p.isCaptain ? p.points * 2 : p.points), 0);

    setHistoryPlayers(enriched);
    setHistoryGwScore(gwScore);
    setLoadingHistory(false);
  }, [userId, pastRounds]);

  const fetchPlayersByIds = async (ids) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, position, price, teams(name)')
        .in('id', ids);
      if (error) throw error;
      return { data: data || [] };
    } catch {
      return { data: [] };
    }
  };

  // ── Live GW points (current mode only) ──
  const liveGameweekPoints = React.useMemo(() => {
    if (enrichedPlayers.length === 0) return 0;
    return enrichedPlayers
      .filter(p => p.isStarter)
      .reduce((sum, player) => {
        const pts = player.points || 0;
        return sum + (player.id === captainId ? pts * 2 : pts);
      }, 0);
  }, [enrichedPlayers, captainId]);

  // ── History derived values ──
  const historyNet = Math.max(0, historyGwScore - historyDeduction);

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

  const sortedOutfieldSubs = enrichedPlayers
    .filter(p => !p.isStarter && p.position === 'Outfield')
    .sort((a, b) => (a.positionOrder || 0) - (b.positionOrder || 0));

  const handleMoveSubUp = async () => {
    const idx = sortedOutfieldSubs.findIndex(p => p.id === selectedPlayer?.id);
    if (idx <= 0) return;
    setModalVisible(false);
    await reorderOutfieldSubs(selectedPlayer.id, sortedOutfieldSubs[idx - 1].id);
    setSelectedPlayer(null);
  };

  const handleMoveSubDown = async () => {
    const idx = sortedOutfieldSubs.findIndex(p => p.id === selectedPlayer?.id);
    if (idx < 0 || idx >= sortedOutfieldSubs.length - 1) return;
    setModalVisible(false);
    await reorderOutfieldSubs(selectedPlayer.id, sortedOutfieldSubs[idx + 1].id);
    setSelectedPlayer(null);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedPlayer(null);
  };

  const getDeadlineText = () => {
    if (!currentRound) return 'No active round';
    if (isLocked) return `Gameweek ${currentRound.round_number} - In Progress`;
    if (timeToDeadline) {
      const { days, hours, minutes } = timeToDeadline;
      if (days > 0) return `Deadline: ${days}d ${hours}h`;
      if (hours > 0) return `Deadline: ${hours}h ${minutes}m`;
      return `Deadline: ${minutes}m`;
    }
    return formatDeadline ? formatDeadline(currentRound.deadline) : 'Deadline passed';
  };

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image source={Icons.swimmer} style={styles.teamEmoji} />
          <Text style={styles.title}>{teamName}</Text>

          {isHistoryMode ? (
            /* History mode: GW score summary */
            <View style={styles.historyScoreRow}>
              <View style={styles.historyScoreBlock}>
                <Text style={styles.historyScoreLabel}>GW {historyRound?.round_number ?? '—'}</Text>
                <Text style={styles.historyScoreValue}>{historyGwScore}</Text>
                <Text style={styles.historyScoreUnit}>pts</Text>
              </View>
              {historyDeduction > 0 && (
                <>
                  <View style={styles.historyScoreDivider} />
                  <View style={styles.historyScoreBlock}>
                    <Text style={styles.historyScoreLabel}>HIT</Text>
                    <Text style={[styles.historyScoreValue, styles.historyScoreHit]}>
                      -{historyDeduction}
                    </Text>
                  </View>
                  <View style={styles.historyScoreDivider} />
                  <View style={styles.historyScoreBlock}>
                    <Text style={styles.historyScoreLabel}>NET</Text>
                    <Text style={[styles.historyScoreValue, styles.historyScoreNet]}>
                      {historyNet}
                    </Text>
                  </View>
                </>
              )}
            </View>
          ) : (
            /* Current mode: Budget / Points / Squad badges */
            <>
              <View style={styles.statsRow}>
                <View style={styles.statBadge}>
                  <Text style={styles.statLabel}>Budget</Text>
                  <Text style={styles.statValue}>${remainingBudget.toFixed(1)}M</Text>
                </View>
                <View style={styles.statBadge}>
                  <Text style={styles.statLabel}>Points</Text>
                  <Text style={styles.statValue}>{liveGameweekPoints}</Text>
                </View>
                <View style={[styles.statBadge, isTeamValid() && styles.statBadgeSuccess]}>
                  <Text style={styles.statLabel}>Squad</Text>
                  <Text style={styles.statValue}>{selectedPlayers.length}/{12}</Text>
                </View>
              </View>
              {currentRound && (
                <View style={styles.deadlineBadge}>
                  <Text style={styles.deadlineText}>{getDeadlineText()}</Text>
                </View>
              )}
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
                Current
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

      {/* ── History read-only banner ── */}
      {isHistoryMode && (
        <View style={styles.historyBanner}>
          <Text style={styles.historyBannerText}>
            Viewing GW{historyRound?.round_number} snapshot — read only
          </Text>
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

      {/* ── Incomplete team warning (current mode only) ── */}
      {!isHistoryMode && !isTeamValid() && selectedPlayers.length > 0 && (
        <View style={styles.warningBanner}>
          <Image source={Icons.warning} style={styles.warningIcon} />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Complete Your Team</Text>
            <Text style={styles.warningText}>
              {goalkeepersCount < 2 && `Need ${2 - goalkeepersCount} more GK • `}
              {outfieldCount < 10 && `Need ${10 - outfieldCount} more Outfield • `}
              {startersCount < 7 && selectedPlayers.length === 12 && `Set ${7 - startersCount} more starters`}
            </Text>
          </View>
        </View>
      )}

      {/* ── Pitch ── */}
      {isHistoryMode && loadingHistory ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.oceanBright} />
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
          <Image source={Icons.player} style={styles.emptyEmoji} />
          <Text style={styles.emptyTitle}>No Players Yet</Text>
          <Text style={styles.emptyText}>
            Start building your team by adding players from the Players tab
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Players')}
            activeOpacity={0.8}>
            <Image source={Icons.player} style={styles.emptyButtonIcon} />
            <Text style={styles.emptyButtonText}>Add Players</Text>
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
                      source={selectedPlayer.position === 'GK' ? Icons.goalie : Icons.player}
                      style={styles.modalPlayerEmoji}
                    />
                    <View>
                      <Text style={styles.modalPlayerName}>{selectedPlayer.name}</Text>
                      <Text style={styles.modalPlayerDetails}>
                        {selectedPlayer.team} • {selectedPlayer.position}
                        {!isHistoryMode && selectedPlayer.price
                          ? ` • $${selectedPlayer.price.toFixed(1)}M`
                          : ''}
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
                      {!selectedPlayer.isStarter && (
                        <Text style={styles.historyBenchNote}>Bench — did not count</Text>
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
                        <Text style={styles.modalButtonSubtext}>2× points</Text>
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
                    {!selectedPlayer.isStarter && selectedPlayer.position === 'Outfield' && (() => {
                      const idx = sortedOutfieldSubs.findIndex(p => p.id === selectedPlayer.id);
                      return (
                        <View style={styles.reorderRow}>
                          <TouchableOpacity
                            style={[styles.reorderButton, idx <= 0 && styles.reorderButtonDisabled]}
                            onPress={handleMoveSubUp}
                            disabled={idx <= 0}
                            activeOpacity={0.8}>
                            <Text style={styles.reorderButtonIcon}>▲</Text>
                            <Text style={styles.reorderButtonText}>Higher Priority</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.reorderButton,
                              idx >= sortedOutfieldSubs.length - 1 && styles.reorderButtonDisabled,
                            ]}
                            onPress={handleMoveSubDown}
                            disabled={idx >= sortedOutfieldSubs.length - 1}
                            activeOpacity={0.8}>
                            <Text style={styles.reorderButtonIcon}>▼</Text>
                            <Text style={styles.reorderButtonText}>Lower Priority</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()}
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
                            source={player.position === 'GK' ? Icons.goalie : Icons.player}
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
    backgroundColor: colors.backgroundLight,
  },

  // ── Header ──
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
  teamEmoji: {
    width: 48,
    height: 48,
    marginBottom: spacing.xs,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  statBadge: {
    backgroundColor: colors.oceanMedium + '40',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.medium,
    borderWidth: 2,
    borderColor: colors.oceanBright + '60',
    alignItems: 'center',
    minWidth: 90,
  },
  statBadgeSuccess: {
    backgroundColor: colors.success + '30',
    borderColor: colors.success,
  },
  statLabel: {
    fontSize: 11,
    color: colors.oceanBright,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    color: colors.white,
    fontWeight: 'bold',
  },
  deadlineBadge: {
    backgroundColor: colors.warning + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: spacing.xs,
  },
  deadlineText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
  },

  // ── History mode header score ──
  historyScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  historyScoreBlock: {
    alignItems: 'center',
  },
  historyScoreLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.oceanBright,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  historyScoreValue: {
    fontSize: 44,
    fontWeight: 'bold',
    color: colors.sand,
  },
  historyScoreUnit: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: -4,
  },
  historyScoreDivider: {
    width: 1,
    height: 52,
    backgroundColor: colors.sand + '30',
  },
  historyScoreHit: {
    color: colors.coral,
    fontSize: 36,
  },
  historyScoreNet: {
    color: '#4ADE80',
    fontSize: 36,
  },

  // ── GW Picker bar ──
  gwPickerWrapper: {
    backgroundColor: colors.oceanMedium,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '30',
  },
  gwPickerScroll: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  gwTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.oceanBright + '50',
    marginRight: spacing.xs,
  },
  gwTabActive: {
    backgroundColor: colors.sand,
    borderColor: colors.sand,
  },
  gwTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.oceanBright,
    letterSpacing: 0.3,
  },
  gwTabTextActive: {
    color: colors.oceanDeep,
  },

  // ── History banner ──
  historyBanner: {
    backgroundColor: colors.oceanMedium + '30',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.oceanBright + '40',
    alignItems: 'center',
  },
  historyBannerText: {
    fontSize: 12,
    color: colors.oceanMedium,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ── Locked / warning banners ──
  lockedBanner: {
    backgroundColor: colors.coral + '18',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 2,
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
    fontSize: 14,
    color: colors.coral,
    fontWeight: '700',
  },
  warningBanner: {
    backgroundColor: colors.warning + '20',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 2,
    borderColor: colors.warning,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    fontSize: 14,
    color: colors.textDark,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 12,
    color: colors.textMedium,
    fontWeight: '600',
  },

  // ── Loading ──
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyEmoji: {
    width: 80,
    height: 80,
    marginBottom: spacing.lg,
    resizeMode: 'contain',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  emptyButton: {
    backgroundColor: colors.oceanMedium,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.medium,
  },
  emptyButtonIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.pearl,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xl + 20,
    ...shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.oceanBright + '20',
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
    resizeMode: 'contain',
  },
  modalPlayerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 4,
  },
  modalPlayerDetails: {
    fontSize: 14,
    color: colors.textMuted,
  },
  modalCaptainBadge: {
    backgroundColor: colors.sand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 2,
    borderColor: colors.oceanDeep,
  },
  modalCaptainText: {
    fontSize: 12,
    fontWeight: 'bold',
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
    ...shadows.small,
  },
  modalButtonCaptain: {
    backgroundColor: '#FCD34D',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  modalButtonSwap: {
    backgroundColor: colors.oceanBright + '30',
    borderWidth: 2,
    borderColor: colors.oceanMedium,
  },
  modalButtonCancel: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 2,
    borderColor: colors.textMuted + '40',
  },
  modalButtonIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
    flex: 1,
  },
  modalButtonSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMuted,
    textAlign: 'center',
    flex: 1,
  },

  // ── History mode player modal ──
  historyPointsBox: {
    backgroundColor: colors.oceanDeep,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  historyPointsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.oceanBright,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  historyPointsValue: {
    fontSize: 56,
    fontWeight: 'bold',
    color: colors.sand,
  },
  historyPointsNote: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  historyBenchNote: {
    fontSize: 12,
    color: colors.coral,
    fontWeight: '600',
    marginTop: spacing.sm,
  },

  // ── Swap modal ──
  swapModalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '20',
  },
  swapModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: spacing.xs,
  },
  swapModalSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
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
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.oceanBright + '30',
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
    resizeMode: 'contain',
  },
  swapPlayerDetails: {
    flex: 1,
  },
  swapPlayerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: spacing.xs,
  },
  swapPlayerMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  swapPlayerArrow: {
    fontSize: 20,
    color: colors.oceanMedium,
    fontWeight: 'bold',
  },

  // ── Sub reorder buttons ──
  reorderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reorderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.teal + '25',
    borderWidth: 2,
    borderColor: colors.teal,
    ...shadows.small,
  },
  reorderButtonDisabled: {
    opacity: 0.35,
  },
  reorderButtonIcon: {
    fontSize: 14,
    color: colors.teal,
    fontWeight: 'bold',
  },
  reorderButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.teal,
  },
});
