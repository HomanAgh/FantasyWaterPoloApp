import React, { useState } from 'react';
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

export default function TransfersScreen({ navigation }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Get team data from context
  const { 
    selectedPlayers, 
    removePlayer,
    remainingBudget,
    totalSpent,
    captainId,
    goalkeepersCount,
    outfieldCount,
    STARTING_BUDGET,
    freeTransfers,
    transfersMadeThisRound,
    pendingDeductions,
    isUnlimitedPhase,
  } = useTeam();

  // Get round info from context
  const { currentRound, isLocked, timeToDeadline, formatDeadline } = useRound();

  /**
   * Handle player card press - show replace modal
   */
  const handlePlayerPress = (playerId, player) => {
    if (isLocked) return;
    setSelectedPlayer(player);
    setModalVisible(true);
  };

  /**
   * Handle empty slot press - navigate to Players screen
   */
  const handleEmptySlotPress = (position, isStarter) => {
    if (isLocked) return;
    
    // Navigate to Players screen and let user add a player
    navigation.navigate('Players', {
      filterPosition: position,
      mode: 'add',
    });
  };

  /**
   * Handle replace player - navigate to Players screen with filter
   */
  const handleReplacePlayer = () => {
    setModalVisible(false);
    
    // Navigate to Players screen with replacement context
    navigation.navigate('Players', {
      replacingPlayer: selectedPlayer,
      filterPosition: selectedPlayer.position,
      mode: 'replace',
    });
    
    setSelectedPlayer(null);
  };

  /**
   * Handle remove player
   */
  const handleRemovePlayer = async () => {
    setModalVisible(false);
    
    Alert.alert(
      'Remove Player',
      `Are you sure you want to remove ${selectedPlayer.name} from your team?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removePlayer(selectedPlayer.id);
            setSelectedPlayer(null);
          },
        },
      ]
    );
  };

  /**
   * Handle view player stats (future feature)
   */
  const handleViewStats = () => {
    setModalVisible(false);
    Alert.alert('Coming Soon', 'Player statistics view will be available in a future update.');
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
      if (days > 0) return `${days}d ${hours}h ${minutes}m`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m remaining`;
    }
    return formatDeadline ? formatDeadline(currentRound.deadline) : 'Deadline passed';
  };

  /**
   * Get team status text
   */
  const getTeamStatus = () => {
    const playersNeeded = 12 - selectedPlayers.length;
    if (playersNeeded > 0) {
      return `${playersNeeded} player${playersNeeded > 1 ? 's' : ''} needed`;
    }
    return 'Squad complete';
  };

  /**
   * Auto-pick best value players to fill empty slots
   */
  const handleAutoPick = () => {
    Alert.alert(
      'Auto-Pick Team',
      'This feature will automatically fill empty slots with the best value players within your budget.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Coming Soon',
          onPress: () => {
            Alert.alert('Coming Soon', 'Auto-pick feature will be available in a future update.');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>🔄</Text>
          <Text style={styles.title}>Transfers</Text>
          
          {/* Budget and Deadline Info */}
          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>Budget</Text>
              <Text style={styles.statValue}>${remainingBudget.toFixed(1)}M</Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>Spent</Text>
              <Text style={styles.statValue}>${totalSpent.toFixed(1)}M</Text>
            </View>
            <View style={[
              styles.statBadge,
              selectedPlayers.length === 12 && styles.statBadgeSuccess
            ]}>
              <Text style={styles.statLabel}>Squad</Text>
              <Text style={styles.statValue}>{selectedPlayers.length}/12</Text>
            </View>
          </View>

          {/* Transfer Info */}
          {isUnlimitedPhase ? (
            <View style={styles.transferInfoBadge}>
              <Text style={styles.transferInfoText}>
                💧 Free Transfers: Unlimited (Pre-GW1)
              </Text>
            </View>
          ) : (
            <View style={styles.transferInfoRow}>
              <View style={[
                styles.transferInfoBadge,
                freeTransfers === 0 && styles.transferInfoBadgeWarning,
              ]}>
                <Text style={styles.transferInfoText}>
                  💧 Free Transfers: {freeTransfers}
                  {freeTransfers === 2 ? ' (Max)' : ''}
                </Text>
              </View>
              {transfersMadeThisRound > 0 && (
                <View style={styles.transfersMadeBadge}>
                  <Text style={styles.transfersMadeText}>
                    {transfersMadeThisRound} made this GW
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Point deductions warning */}
          {pendingDeductions > 0 && (
            <View style={styles.deductionBadge}>
              <Text style={styles.deductionText}>
                ⚠️ -{pendingDeductions} pts hit this GW
              </Text>
            </View>
          )}

          {/* Deadline */}
          {currentRound && (
            <View style={[
              styles.deadlineBadge,
              isLocked && styles.deadlineBadgeLocked
            ]}>
              <Text style={styles.deadlineIcon}>
                {isLocked ? '🔒' : '⏰'}
              </Text>
              <Text style={styles.deadlineText}>
                {getDeadlineText()}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Locked Banner */}
      {isLocked && currentRound && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <View style={styles.lockedContent}>
            <Text style={styles.lockedTitle}>Transfers Locked</Text>
            <Text style={styles.lockedText}>
              Gameweek {currentRound.round_number} is in progress. Transfers will reopen after matches complete.
            </Text>
          </View>
        </View>
      )}

      {/* Team Status */}
      {!isLocked && selectedPlayers.length < 12 && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusIcon}>📋</Text>
          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>{getTeamStatus()}</Text>
            <Text style={styles.statusText}>
              {goalkeepersCount < 2 && `${2 - goalkeepersCount} GK needed • `}
              {outfieldCount < 10 && `${10 - outfieldCount} Outfield needed`}
            </Text>
          </View>
        </View>
      )}

      {/* Pitch View */}
      {selectedPlayers.length > 0 ? (
        <>
          <PitchView
            players={selectedPlayers}
            captainId={captainId}
            mode="transfers"
            onPlayerPress={handlePlayerPress}
            onEmptySlotPress={handleEmptySlotPress}
            isLocked={isLocked}
          />

          {/* Action Buttons */}
          {!isLocked && (
            <View style={styles.actionsCard}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Players')}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonIcon}>➕</Text>
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionButtonText}>Add Players</Text>
                  <Text style={styles.actionButtonSubtext}>
                    Browse all available players
                  </Text>
                </View>
              </TouchableOpacity>

              {selectedPlayers.length < 12 && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={handleAutoPick}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionButtonIcon}>✨</Text>
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonText}>Auto-Pick</Text>
                    <Text style={styles.actionButtonSubtext}>
                      Fill empty slots automatically
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      ) : (
        <ScrollView style={styles.emptyContainer} contentContainerStyle={styles.emptyContent}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>Start Building Your Team</Text>
          <Text style={styles.emptyText}>
            You have ${STARTING_BUDGET.toFixed(1)}M to build a squad of 12 players
          </Text>
          
          <View style={styles.emptyRequirements}>
            <View style={styles.emptyRequirementItem}>
              <Text style={styles.emptyRequirementIcon}>🥅</Text>
              <Text style={styles.emptyRequirementText}>2 Goalkeepers</Text>
            </View>
            <View style={styles.emptyRequirementItem}>
              <Text style={styles.emptyRequirementIcon}>🏊</Text>
              <Text style={styles.emptyRequirementText}>10 Field Players</Text>
            </View>
            <View style={styles.emptyRequirementItem}>
              <Text style={styles.emptyRequirementIcon}>⭐</Text>
              <Text style={styles.emptyRequirementText}>7 Starters + 5 Subs</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Players')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonIcon}>➕</Text>
            <Text style={styles.emptyButtonText}>Select Players</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Player Action Modal */}
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
                    <View style={styles.modalPlayerDetails}>
                      <Text style={styles.modalPlayerName}>{selectedPlayer.name}</Text>
                      <Text style={styles.modalPlayerSubtext}>
                        {selectedPlayer.team} • {selectedPlayer.position}
                      </Text>
                      <View style={styles.modalPlayerPriceContainer}>
                        <Text style={styles.modalPlayerPrice}>
                          ${selectedPlayer.price.toFixed(1)}M
                        </Text>
                        <Text style={styles.modalPlayerPoints}>
                          {selectedPlayer.points} pts
                        </Text>
                      </View>
                    </View>
                  </View>
                  {selectedPlayer.id === captainId && (
                    <View style={styles.modalCaptainBadge}>
                      <Text style={styles.modalCaptainText}>C</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  {/* Replace Player */}
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={handleReplacePlayer}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonIcon}>🔄</Text>
                    <View style={styles.modalButtonTextContainer}>
                      <Text style={styles.modalButtonText}>Replace Player</Text>
                      <Text style={styles.modalButtonSubtext}>
                        Find {selectedPlayer.position === 'GK' ? 'another goalkeeper' : 'another field player'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* View Stats (future feature) */}
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    onPress={handleViewStats}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonIcon}>📊</Text>
                    <View style={styles.modalButtonTextContainer}>
                      <Text style={styles.modalButtonText}>View Stats</Text>
                      <Text style={styles.modalButtonSubtext}>
                        Performance and history
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Remove Player */}
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonDanger]}
                    onPress={handleRemovePlayer}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonIcon}>🗑️</Text>
                    <View style={styles.modalButtonTextContainer}>
                      <Text style={styles.modalButtonTextDanger}>Remove from Team</Text>
                      <Text style={styles.modalButtonSubtextDanger}>
                        Free up ${selectedPlayer.price.toFixed(1)}M
                      </Text>
                    </View>
                  </TouchableOpacity>

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
  headerEmoji: {
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
    gap: spacing.sm,
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
    minWidth: 85,
  },
  statBadgeSuccess: {
    backgroundColor: colors.success + '30',
    borderColor: colors.success,
  },
  statLabel: {
    fontSize: 10,
    color: colors.oceanBright,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    color: colors.white,
    fontWeight: 'bold',
  },
  transferInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  transferInfoBadge: {
    backgroundColor: colors.success + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.success,
    marginBottom: spacing.xs,
  },
  transferInfoBadgeWarning: {
    backgroundColor: colors.warning + '30',
    borderColor: colors.warning,
  },
  transferInfoText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '600',
  },
  transfersMadeBadge: {
    backgroundColor: colors.oceanMedium + '40',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.oceanBright + '60',
    marginBottom: spacing.xs,
  },
  transfersMadeText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: '600',
  },
  deductionBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: spacing.xs,
  },
  deductionText: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: '700',
  },
  deadlineBadge: {
    backgroundColor: colors.warning + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.warning,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deadlineBadgeLocked: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  deadlineIcon: {
    fontSize: 12,
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
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  lockedIcon: {
    fontSize: 24,
  },
  lockedContent: {
    flex: 1,
  },
  lockedTitle: {
    fontSize: 14,
    color: '#991B1B',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  lockedText: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '600',
  },
  statusBanner: {
    backgroundColor: colors.info + '20',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 2,
    borderColor: colors.info,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIcon: {
    fontSize: 24,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    color: colors.textDark,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statusText: {
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
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  emptyRequirements: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.large,
    marginBottom: spacing.xl,
    ...shadows.medium,
    borderWidth: 1,
    borderColor: colors.oceanBright + '20',
  },
  emptyRequirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyRequirementIcon: {
    fontSize: 24,
  },
  emptyRequirementText: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
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
  actionsCard: {
    backgroundColor: colors.white,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.large,
    ...shadows.medium,
    borderWidth: 1,
    borderColor: colors.oceanBright + '20',
    gap: spacing.md,
  },
  actionButton: {
    backgroundColor: colors.oceanMedium,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.small,
  },
  actionButtonSecondary: {
    backgroundColor: colors.oceanBright + '30',
    borderWidth: 2,
    borderColor: colors.oceanMedium,
  },
  actionButtonIcon: {
    fontSize: 28,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 2,
  },
  actionButtonSubtext: {
    fontSize: 12,
    color: colors.white + 'DD',
    fontWeight: '500',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.oceanBright + '20',
  },
  modalPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    flex: 1,
  },
  modalPlayerEmoji: {
    fontSize: 56,
  },
  modalPlayerDetails: {
    flex: 1,
  },
  modalPlayerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 4,
  },
  modalPlayerSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  modalPlayerPriceContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  modalPlayerPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.oceanMedium,
  },
  modalPlayerPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },
  modalCaptainBadge: {
    backgroundColor: '#FCD34D',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  modalCaptainText: {
    fontSize: 14,
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
    gap: spacing.md,
    ...shadows.small,
  },
  modalButtonPrimary: {
    backgroundColor: colors.oceanMedium,
  },
  modalButtonSecondary: {
    backgroundColor: colors.info + '30',
    borderWidth: 2,
    borderColor: colors.info,
  },
  modalButtonDanger: {
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  modalButtonCancel: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 2,
    borderColor: colors.textMuted + '40',
  },
  modalButtonIcon: {
    fontSize: 28,
  },
  modalButtonTextContainer: {
    flex: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 2,
  },
  modalButtonSubtext: {
    fontSize: 12,
    color: colors.white + 'DD',
    fontWeight: '500',
  },
  modalButtonTextDanger: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 2,
  },
  modalButtonSubtextDanger: {
    fontSize: 12,
    color: '#991B1B' + 'DD',
    fontWeight: '500',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMuted,
    textAlign: 'center',
    flex: 1,
  },
});
