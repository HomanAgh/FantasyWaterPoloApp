import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { useTeam } from '../context/TeamContext';
import { useRound } from '../context/RoundContext';
import PitchView from '../components/PitchView';
import * as playerRoundPointsService from '../services/playerRoundPointsService';

export default function MyTeamScreen({ navigation }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [enrichedPlayers, setEnrichedPlayers] = useState([]);

  // Get team data from context
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

  // Get round info from context
  const { currentRound, isLocked, timeToDeadline, formatDeadline } = useRound();

  /**
   * Load gameweek points for all players
   */
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
        points: pointsMap[p.id] || 0  // Replace career points with gameweek points
      }));
      
      setEnrichedPlayers(enriched);
    };

    loadGameweekPoints();
  }, [currentRound, selectedPlayers]);

  /**
   * Calculate live gameweek points (including captain bonus)
   */
  const liveGameweekPoints = React.useMemo(() => {
    if (enrichedPlayers.length === 0) return 0;
    
    return enrichedPlayers
      .filter(p => p.isStarter) // Only count starters
      .reduce((sum, player) => {
        const points = player.points || 0;
        // Captain gets 2x points
        if (player.id === captainId) {
          return sum + (points * 2);
        }
        return sum + points;
      }, 0);
  }, [enrichedPlayers, captainId]);

  /**
   * Handle player card press - show action modal
   */
  const handlePlayerPress = (playerId, player) => {
    setSelectedPlayer(player);
    setModalVisible(true);
  };

  /**
   * Handle empty slot press
   */
  const handleEmptySlotPress = (position, isStarter) => {
    navigation.navigate('Transfers');
  };

  /**
   * Show swap modal to select which player to swap with
   */
  const handleShowSwapModal = () => {
    setModalVisible(false);
    setSwapModalVisible(true);
  };

  /**
   * Perform the swap between selected player and chosen swap target
   */
  const handleSwapWithPlayer = async (targetPlayerId) => {
    setSwapModalVisible(false);
    await swapPlayers(selectedPlayer.id, targetPlayerId);
    setSelectedPlayer(null);
  };

  /**
   * Set player as captain
   */
  const handleSetCaptain = async () => {
    setModalVisible(false);
    await setCaptain(selectedPlayer.id, isLocked);
    setSelectedPlayer(null);
  };

  /**
   * Outfield substitutes sorted by priority (positionOrder), used for reordering
   */
  const sortedOutfieldSubs = enrichedPlayers
    .filter(p => !p.isStarter && p.position === 'Outfield')
    .sort((a, b) => (a.positionOrder || 0) - (b.positionOrder || 0));

  /**
   * Move the selected outfield sub one position higher in priority
   */
  const handleMoveSubUp = async () => {
    const idx = sortedOutfieldSubs.findIndex(p => p.id === selectedPlayer?.id);
    if (idx <= 0) return;
    setModalVisible(false);
    const swapTarget = sortedOutfieldSubs[idx - 1];
    await reorderOutfieldSubs(selectedPlayer.id, swapTarget.id);
    setSelectedPlayer(null);
  };

  /**
   * Move the selected outfield sub one position lower in priority
   */
  const handleMoveSubDown = async () => {
    const idx = sortedOutfieldSubs.findIndex(p => p.id === selectedPlayer?.id);
    if (idx < 0 || idx >= sortedOutfieldSubs.length - 1) return;
    setModalVisible(false);
    const swapTarget = sortedOutfieldSubs[idx + 1];
    await reorderOutfieldSubs(selectedPlayer.id, swapTarget.id);
    setSelectedPlayer(null);
  };

  /**
   * Close modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedPlayer(null);
  };

  /**
   * Format time to deadline
   */
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.teamEmoji}>🏊</Text>
          <Text style={styles.title}>{teamName}</Text>
          
          {/* Budget and Status Row */}
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
              <Text style={styles.statValue}>
                {selectedPlayers.length}/{12}
              </Text>
            </View>
          </View>

          {/* Deadline Info */}
          {currentRound && (
            <View style={styles.deadlineBadge}>
              <Text style={styles.deadlineText}>
                {getDeadlineText()}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Locked Team Banner */}
      {isLocked && currentRound && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <Text style={styles.lockedText}>
            Team Locked - Gameweek {currentRound.round_number} in progress
          </Text>
        </View>
      )}

      {/* Team Status Message */}
      {!isTeamValid() && selectedPlayers.length > 0 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>⚠️</Text>
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

      {/* Pitch View */}
      {enrichedPlayers.length > 0 ? (
        <PitchView
          players={enrichedPlayers}
          captainId={captainId}
          mode="pickTeam"
          onPlayerPress={handlePlayerPress}
          onEmptySlotPress={handleEmptySlotPress}
          isLocked={isLocked}
        />
      ) : (
        <ScrollView style={styles.emptyContainer} contentContainerStyle={styles.emptyContent}>
          <Text style={styles.emptyEmoji}>🏊‍♂️</Text>
          <Text style={styles.emptyTitle}>No Players Yet</Text>
          <Text style={styles.emptyText}>
            Start building your team by adding players from the Players tab
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Players')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonIcon}>➕</Text>
            <Text style={styles.emptyButtonText}>Add Players</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Action Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseModal}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {selectedPlayer && (
              <>
                {/* Player Info Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalPlayerInfo}>
                    <Text style={styles.modalPlayerEmoji}>
                      {selectedPlayer.position === 'GK' ? '🥅' : '🏊'}
                    </Text>
                    <View>
                      <Text style={styles.modalPlayerName}>{selectedPlayer.name}</Text>
                      <Text style={styles.modalPlayerDetails}>
                        {selectedPlayer.team} • {selectedPlayer.position} • ${selectedPlayer.price.toFixed(1)}M
                      </Text>
                    </View>
                  </View>
                  {selectedPlayer.id === captainId && (
                    <View style={styles.modalCaptainBadge}>
                      <Text style={styles.modalCaptainText}>Captain</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  {/* Set as Captain (only for starters) */}
                  {selectedPlayer.isStarter && selectedPlayer.id !== captainId && (
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonCaptain]}
                      onPress={handleSetCaptain}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.modalButtonIcon}>⭐</Text>
                      <Text style={styles.modalButtonText}>Set as Captain</Text>
                      <Text style={styles.modalButtonSubtext}>2× points</Text>
                    </TouchableOpacity>
                  )}

                  {/* Swap with Substitute / Swap with Starter */}
                  {selectedPlayer.isStarter ? (
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonSwap]}
                      onPress={handleShowSwapModal}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.modalButtonIcon}>🔄</Text>
                      <Text style={styles.modalButtonText}>Swap with Substitute</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonSwap]}
                      onPress={handleShowSwapModal}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.modalButtonIcon}>🔄</Text>
                      <Text style={styles.modalButtonText}>Swap with Starter</Text>
                    </TouchableOpacity>
                  )}

                  {/* Reorder priority for outfield subs */}
                  {!selectedPlayer.isStarter && selectedPlayer.position === 'Outfield' && (() => {
                    const idx = sortedOutfieldSubs.findIndex(p => p.id === selectedPlayer.id);
                    return (
                      <View style={styles.reorderRow}>
                        <TouchableOpacity
                          style={[
                            styles.reorderButton,
                            idx <= 0 && styles.reorderButtonDisabled,
                          ]}
                          onPress={handleMoveSubUp}
                          disabled={idx <= 0}
                          activeOpacity={0.8}
                        >
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
                          activeOpacity={0.8}
                        >
                          <Text style={styles.reorderButtonIcon}>▼</Text>
                          <Text style={styles.reorderButtonText}>Lower Priority</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}

                  {/* Cancel Button */}
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={handleCloseModal}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Swap Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={swapModalVisible}
        onRequestClose={() => setSwapModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setSwapModalVisible(false);
            setSelectedPlayer(null);
          }}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {selectedPlayer && (
              <>
                {/* Header */}
                <View style={styles.swapModalHeader}>
                  <Text style={styles.swapModalTitle}>
                    Select player to swap with
                  </Text>
                  <Text style={styles.swapModalSubtitle}>
                    {selectedPlayer.name} ({selectedPlayer.position})
                  </Text>
                </View>

                {/* List of eligible swap candidates */}
                <ScrollView style={styles.swapPlayersList}>
                  {enrichedPlayers
                    .filter(p => 
                      p.id !== selectedPlayer.id && // Not the same player
                      p.position === selectedPlayer.position && // Same position
                      p.isStarter !== selectedPlayer.isStarter // Different starter status
                    )
                    .map(player => (
                      <TouchableOpacity
                        key={player.id}
                        style={styles.swapPlayerCard}
                        onPress={() => handleSwapWithPlayer(player.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.swapPlayerInfo}>
                          <Text style={styles.swapPlayerEmoji}>
                            {player.position === 'GK' ? '🥅' : '🏊'}
                          </Text>
                          <View style={styles.swapPlayerDetails}>
                            <Text style={styles.swapPlayerName}>{player.name}</Text>
                            <Text style={styles.swapPlayerMeta}>
                              {player.team} • {player.points} pts
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.swapPlayerArrow}>→</Text>
                      </TouchableOpacity>
                    ))
                  }
                </ScrollView>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setSwapModalVisible(false);
                    setSelectedPlayer(null);
                  }}
                  activeOpacity={0.8}
                >
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
    fontSize: 40,
    marginBottom: spacing.xs,
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
  lockedBanner: {
    backgroundColor: '#FEE2E2',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 2,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  lockedIcon: {
    fontSize: 20,
  },
  lockedText: {
    fontSize: 14,
    color: '#991B1B',
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
    fontSize: 24,
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
    fontSize: 80,
    marginBottom: spacing.lg,
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
    fontSize: 20,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
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
    fontSize: 48,
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
    backgroundColor: '#FCD34D',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  modalCaptainText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
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
    fontSize: 24,
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
  // Swap Modal Styles
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
    fontSize: 28,
    marginRight: spacing.md,
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
  // Bottom Bar
  bottomBar: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.md + 20,
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.oceanBright + '20',
    ...shadows.large,
  },
  bottomButton: {
    flex: 1,
    backgroundColor: colors.oceanMedium,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...shadows.small,
  },
  bottomButtonSecondary: {
    backgroundColor: colors.oceanBright + '30',
    borderWidth: 2,
    borderColor: colors.oceanMedium,
  },
  bottomButtonDisabled: {
    opacity: 0.5,
  },
  bottomButtonIcon: {
    fontSize: 16,
  },
  bottomButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
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
