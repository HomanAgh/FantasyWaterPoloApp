import React, { useState, useEffect } from 'react';
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
import PitchView from '../components/PitchView';
import { startReplaceSession } from '../utils/transferReplaceSession';
import { preloadRewardedAd } from '../services/adsService';

export default function TransfersScreen({ navigation }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isUnlockingAd, setIsUnlockingAd] = useState(false);

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
    unlockedFreeTransfers,
    unlockFreeTransferFromAd,
    transfersMadeThisRound,
    isUnlimitedPhase,
    MAX_PLAYERS,
    MAX_OUTFIELD,
    MAX_SUBSTITUTES,
  } = useTeam();

  const { currentRound, isLocked, timeToDeadline, formatDeadline } = useRound();

  const canUnlockMore =
    !isUnlimitedPhase && !isLocked && freeTransfers > unlockedFreeTransfers;

  useEffect(() => {
    if (!isUnlimitedPhase && !isLocked) {
      preloadRewardedAd().catch(() => {
        // Consent-gated; ignore preload failures
      });
    }
  }, [isUnlimitedPhase, isLocked]);

  const handlePlayerPress = (playerId, player) => {
    if (isLocked) return;
    setSelectedPlayer(player);
    setModalVisible(true);
  };

  const handleEmptySlotPress = (position, isStarter) => {
    if (isLocked) return;
    navigation.navigate('Players', {
      filterPosition: position,
      mode: 'add',
    });
  };

  const handleReplacePlayer = () => {
    setModalVisible(false);
    const replaceToken = Date.now();
    startReplaceSession({
      replacingPlayer: selectedPlayer,
      filterPosition: selectedPlayer.position,
      replaceToken,
    });
    navigation.navigate('Players', {
      replacingPlayer: selectedPlayer,
      filterPosition: selectedPlayer.position,
      mode: 'replace',
      replaceToken,
    });
    setSelectedPlayer(null);
  };

  const handleRemovePlayer = async () => {
    setModalVisible(false);
    Alert.alert(
      'Remove Player',
      `Are you sure you want to remove ${selectedPlayer.name} from your team?`,
      [
        { text: 'Cancel', style: 'cancel' },
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

  const handleViewStats = () => {
    if (!selectedPlayer) return;
    const player = selectedPlayer;
    setModalVisible(false);
    setSelectedPlayer(null);
    navigation.navigate('PlayerDetail', { playerId: player.id, player });
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedPlayer(null);
  };

  const getDeadlineText = () => {
    if (!currentRound) return 'NO ROUND';
    if (isLocked) return `GW${currentRound.round_number} LIVE`;
    if (timeToDeadline) {
      const { days, hours, minutes } = timeToDeadline;
      if (days > 0) return `${days}D ${hours}H`;
      if (hours > 0) return `${hours}H ${minutes}M`;
      return `${minutes}M`;
    }
    return formatDeadline ? formatDeadline(currentRound.deadline) : 'PASSED';
  };

  const getFreeTransfersText = () => {
    if (isUnlimitedPhase) return 'Unlimited';
    if (freeTransfers === 0) return '0 FREE TRANSFERS';
    return `FREE TRANSFER ${unlockedFreeTransfers}/${freeTransfers}`;
  };

  const handleUnlockFreeTransfer = () => {
    if (!canUnlockMore || isUnlockingAd) return;

    Alert.alert(
      'Unlock Free Transfer?',
      'Watch a short ad to unlock 1 free transfer for this gameweek.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Watch Ad',
          onPress: async () => {
            setIsUnlockingAd(true);
            try {
              await unlockFreeTransferFromAd();
            } finally {
              setIsUnlockingAd(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>TRANSFERS</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>BUDGET</Text>
              <Text style={styles.statValue}>${remainingBudget.toFixed(1)}M</Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>SPENT</Text>
              <Text style={styles.statValue}>${totalSpent.toFixed(1)}M</Text>
            </View>
            <View
              style={[
                styles.statBadge,
                selectedPlayers.length === MAX_PLAYERS && styles.statBadgeSuccess,
              ]}
            >
              <Text style={styles.statLabel}>SQUAD</Text>
              <Text style={styles.statValue}>{selectedPlayers.length}/{MAX_PLAYERS}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View
              style={[
                styles.infoBadge,
                styles.transferInfoBadge,
                !isUnlimitedPhase && freeTransfers === 0 && styles.transferInfoWarning,
                !isUnlimitedPhase &&
                  freeTransfers > 0 &&
                  unlockedFreeTransfers > 0 &&
                  styles.transferInfoReady,
              ]}
            >
              <Text style={styles.transferInfoText} numberOfLines={2}>
                {getFreeTransfersText()}
              </Text>
            </View>

            {!isUnlimitedPhase && (
              <View style={[styles.infoBadge, styles.transfersMadeBadge]}>
                <Text style={styles.transfersMadeText} numberOfLines={2}>
                  {transfersMadeThisRound} MADE THIS GW
                </Text>
              </View>
            )}

            {currentRound && (
              <View style={[styles.infoBadge, styles.deadlineBadge]}>
                <Image
                  source={isLocked ? Icons.locked : Icons.clock}
                  style={styles.deadlineIcon}
                />
                <Text style={styles.deadlineText} numberOfLines={2}>
                  {getDeadlineText()}
                </Text>
              </View>
            )}
          </View>

          {canUnlockMore && (
            <View style={styles.unlockButtonRow}>
              <TouchableOpacity
                style={[
                  styles.outlineButton,
                  styles.unlockButton,
                  isUnlockingAd && styles.unlockButtonDisabled,
                ]}
                onPress={handleUnlockFreeTransfer}
                disabled={isUnlockingAd}
                activeOpacity={0.8}
              >
                {isUnlockingAd ? (
                  <ActivityIndicator color={colors.auth.neon} size="small" />
                ) : (
                  <>
                    <Image
                      source={Icons.plus}
                      style={[styles.outlineButtonIcon, styles.iconNeon]}
                    />
                    <Text style={styles.outlineButtonText}>UNLOCK FREE TRANSFER</Text>
                    <Text style={styles.chevron}>›</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>

      {/* ── Locked banner ── */}
      {isLocked && currentRound && (
        <View style={styles.lockedBanner}>
          <Image source={Icons.locked} style={styles.lockedIcon} />
          <View style={styles.lockedContent}>
            <Text style={styles.lockedTitle}>Transfers locked</Text>
            <Text style={styles.lockedText}>
              Gameweek {currentRound.round_number} is in progress. Transfers reopen after matches complete.
            </Text>
          </View>
        </View>
      )}

      {/* ── Incomplete squad nudge ── */}
      {!isLocked && selectedPlayers.length > 0 && selectedPlayers.length < MAX_PLAYERS && (
        <View style={styles.statusBanner}>
          <Image source={Icons.warning} style={styles.statusIcon} />
          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              ADD {MAX_PLAYERS - selectedPlayers.length} MORE TO COMPLETE YOUR SQUAD
            </Text>
            <Text style={styles.statusText}>
              {goalkeepersCount < 2 && `Need ${2 - goalkeepersCount} more GK • `}
              {outfieldCount < MAX_OUTFIELD && `Need ${MAX_OUTFIELD - outfieldCount} more Outfield`}
            </Text>
          </View>
        </View>
      )}

      {/* ── Pitch / Empty ── */}
      {selectedPlayers.length > 0 ? (
        <PitchView
          players={selectedPlayers}
          captainId={captainId}
          mode="transfers"
          onPlayerPress={handlePlayerPress}
          onEmptySlotPress={handleEmptySlotPress}
          isLocked={isLocked}
        />
      ) : (
        <ScrollView
          style={styles.emptyContainer}
          contentContainerStyle={styles.emptyContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => !isLocked && navigation.navigate('Players')}
            activeOpacity={0.85}
            disabled={isLocked}
          >
            <Image source={Icons.roboplayer} style={styles.emptyEmoji} />
            <Text style={styles.emptyTitle}>START BUILDING YOUR TEAM</Text>
            <Text style={styles.emptyText}>
              {`You have $${STARTING_BUDGET.toFixed(1)}M\nto build a squad of ${MAX_PLAYERS} players.`}
            </Text>
          </TouchableOpacity>

          <View style={styles.requirementsGrid}>
            <View style={styles.requirementRow}>
              <View style={styles.requirementItem}>
                <View style={styles.requirementNumBox}>
                  <Text style={styles.requirementNum}>2</Text>
                </View>
                <Text style={styles.requirementLabel}>GOALKEEPERS</Text>
              </View>
              <View style={styles.requirementItem}>
                <View style={styles.requirementNumBox}>
                  <Text style={styles.requirementNum}>{MAX_OUTFIELD}</Text>
                </View>
                <Text style={styles.requirementLabel}>FIELD PLAYERS</Text>
              </View>
            </View>
            <View style={styles.requirementRow}>
              <View style={styles.requirementItem}>
                <View style={styles.requirementNumBox}>
                  <Text style={styles.requirementNum}>7</Text>
                </View>
                <Text style={styles.requirementLabel}>STARTERS</Text>
              </View>
              <View style={styles.requirementItem}>
                <View style={styles.requirementNumBox}>
                  <Text style={styles.requirementNum}>{MAX_SUBSTITUTES}</Text>
                </View>
                <Text style={styles.requirementLabel}>SUBSTITUTES</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ── Player Action Modal ── */}
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
                        {selectedPlayer.price
                          ? ` • $${selectedPlayer.price.toFixed(1)}M`
                          : ''}
                        {` • ${selectedPlayer.points ?? 0} pts`}
                      </Text>
                    </View>
                  </View>
                  {selectedPlayer.id === captainId && (
                    <View style={styles.modalCaptainBadge}>
                      <Text style={styles.modalCaptainText}>C</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={handleReplacePlayer}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={Icons.swap}
                      style={[styles.outlineButtonIcon, styles.iconNeon]}
                    />
                    <Text style={styles.outlineButtonText}>REPLACE PLAYER</Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={handleViewStats}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={Icons.graph}
                      style={[styles.outlineButtonIcon, styles.iconNeon]}
                    />
                    <Text style={styles.outlineButtonText}>VIEW STATS</Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>

                  {isUnlimitedPhase && (
                    <TouchableOpacity
                      style={[styles.outlineButton, styles.outlineButtonDanger]}
                      onPress={handleRemovePlayer}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={Icons.warning}
                        style={[styles.outlineButtonIcon, styles.iconCoral]}
                      />
                      <View style={styles.outlineButtonTextContainer}>
                        <Text style={styles.outlineButtonTextDanger}>REMOVE FROM TEAM</Text>
                        <Text style={styles.outlineButtonSubtextDanger}>
                          Free up ${selectedPlayer.price.toFixed(1)}M
                        </Text>
                      </View>
                      <Text style={[styles.chevron, styles.chevronDanger]}>›</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={handleCloseModal}
                    activeOpacity={0.8}
                  >
                    <View style={styles.outlineButtonIconSpacer} />
                    <Text style={styles.outlineButtonText}>CANCEL</Text>
                    <Text style={styles.chevron}>›</Text>
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
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 64,
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.xxl + 32,
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
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
    fontSize: 16,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    marginBottom: -2,
  },
  statValue: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 28,
    color: colors.auth.statValue,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    width: '100%',
  },
  transferInfoReady: {
    borderColor: colors.sand,
  },
  unlockButtonRow: {
    marginTop: spacing.sm,
    width: '100%',
  },
  unlockButton: {
    width: '85%',
    marginTop: 0,
    justifyContent: 'center',
    minHeight: 52,
    backgroundColor: colors.auth.glass
  },
  unlockButtonDisabled: {
    opacity: 0.6,
  },
  infoBadge: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 0.5,
    backgroundColor: colors.auth.inputBg,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  transferInfoBadge: {
    borderColor: colors.auth.neon,
  },
  transferInfoWarning: {
    borderColor: colors.warning,
  },
  transferInfoText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.white,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  transfersMadeBadge: {
    borderColor: colors.auth.neonSoft,
  },
  transfersMadeText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.white,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  deadlineBadge: {
    flexDirection: 'row',
    gap: 6,
    borderColor: colors.sand,
  },
  deadlineIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: colors.sand,
  },
  deadlineText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.sand,
    letterSpacing: 0.5,
    textAlign: 'center',
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
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  lockedIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  lockedContent: {
    flex: 1,
  },
  lockedTitle: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.coral,
    marginBottom: 2,
  },
  lockedText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.white,
  },

  statusBanner: {
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
  statusIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 14,
    color: colors.sand,
    marginBottom: 2,
  },
  statusText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 12,
    color: colors.white,
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
    marginBottom: spacing.lg,
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
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 18,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 24,
  },

  requirementsGrid: {
    width: '100%',
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  requirementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  requirementItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requirementNumBox: {
    width: 58,
    height: 46,
    borderRadius: borderRadius.small,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    backgroundColor: colors.auth.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requirementNum: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 24,
    color: colors.white,
  },
  requirementLabel: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 0.5,
    flexShrink: 1,
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
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.small,
  },
  modalCaptainText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 12,
    color: colors.oceanDeep,
  },
  modalActions: {
    gap: spacing.sm,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    borderRadius: borderRadius.round,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  outlineButtonDanger: {
    borderColor: colors.coral,
    backgroundColor: 'rgba(229, 57, 53, 0.12)',
  },
  outlineButtonIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    marginRight: spacing.sm,
  },
  outlineButtonIconSpacer: {
    width: 20,
    marginRight: spacing.sm,
  },
  outlineButtonText: {
    flex: 1,
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 24,
    color: colors.white,
    letterSpacing: 0.5,
  },
  outlineButtonTextContainer: {
    flex: 1,
  },
  outlineButtonTextDanger: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 22,
    color: colors.coral,
    letterSpacing: 0.5,
  },
  outlineButtonSubtextDanger: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 12,
    color: colors.coral,
    opacity: 0.8,
    marginTop: 2,
  },
  iconNeon: {
    tintColor: colors.auth.neon,
  },
  iconCoral: {
    tintColor: colors.coral,
  },
  chevron: {
    fontSize: 28,
    color: colors.auth.neon,
    fontWeight: '300',
    lineHeight: 28,
    marginTop: -2,
  },
  chevronDanger: {
    color: colors.coral,
  },
});
