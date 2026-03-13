import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { useTeam } from '../context/TeamContext';
import { useRound } from '../context/RoundContext';

export default function MyTeamScreen({ navigation }) {
  // Get team data from context
  const { 
    selectedPlayers, 
    removePlayer,
    setPlayerAsStarter,
    remainingBudget,
    totalSpent,
    captainId,
    setCaptain
  } = useTeam();

  // Get round info from context
  const { currentRound, isLocked } = useRound();

  // Separate players by position and starter status
  const starters = selectedPlayers.filter(p => p.isStarter);
  const substitutes = selectedPlayers.filter(p => !p.isStarter);

  const starterGK = starters.find(p => p.position === 'GK');
  const starterOutfield = starters.filter(p => p.position === 'Outfield');

  const subGK = substitutes.find(p => p.position === 'GK');
  const subOutfield = substitutes.filter(p => p.position === 'Outfield');

  // Calculate counts for summary
  const gkCount = selectedPlayers.filter(p => p.position === 'GK').length;
  const outfieldCount = selectedPlayers.filter(p => p.position === 'Outfield').length;
  const starterCount = starters.length;
  const subCount = substitutes.length;

  const handleToggleStarter = async (playerId, currentStatus) => {
    await setPlayerAsStarter(playerId, !currentStatus);
  };

  const handleRemovePlayer = async (playerId) => {
    await removePlayer(playerId);
  };

  const handleSetCaptain = async (playerId) => {
    await setCaptain(playerId, isLocked);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.teamEmoji}>🏊</Text>
          <Text style={styles.title}>My Fantasy Team</Text>
          <View style={styles.budgetBadge}>
            <Text style={styles.budgetLabel}>Budget</Text>
            <Text style={styles.budgetAmount}>${remainingBudget.toFixed(1)}M</Text>
          </View>
          <Text style={styles.spentText}>Spent: ${totalSpent.toFixed(1)}M</Text>
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

      {/* Starters Section */}
      <View style={[styles.card, styles.formationCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Starters ({starterCount}/7)</Text>
          <Text style={styles.formationIcon}>⭐</Text>
        </View>
        
        {/* Starter GK */}
        <View style={styles.positionSection}>
          <Text style={styles.positionLabel}>🥅 Goalkeeper (1)</Text>
          {starterGK ? (
            <View style={styles.playerCardItem}>
              <View style={styles.playerCardInfo}>
                <Text style={styles.playerCardName}>{starterGK.name}</Text>
                <Text style={styles.playerCardDetails}>
                  {starterGK.team} • ${starterGK.price.toFixed(1)}M • {starterGK.points} pts
                </Text>
              </View>
              <View style={styles.playerCardActions}>
                <TouchableOpacity 
                  style={[
                    styles.captainBadge,
                    starterGK.id === captainId && styles.captainBadgeActive
                  ]}
                  onPress={() => !isLocked && handleSetCaptain(starterGK.id)}
                  disabled={isLocked}
                  activeOpacity={0.7}>
                  <Text style={[
                    styles.captainText,
                    starterGK.id === captainId && styles.captainTextActive
                  ]}>
                    {starterGK.id === captainId ? 'C (2×)' : 'C'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.toggleButton, isLocked && styles.disabledButton]}
                  onPress={() => handleToggleStarter(starterGK.id, true)}
                  disabled={isLocked}
                  activeOpacity={0.7}>
                  <Text style={styles.toggleButtonText}>→ Sub</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.removeButtonSmall, isLocked && styles.disabledButton]}
                  onPress={() => handleRemovePlayer(starterGK.id)}
                  disabled={isLocked}
                  activeOpacity={0.7}>
                  <Text style={styles.removeButtonSmallText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.emptySlot}>
              <Text style={styles.emptySlotText}>Empty GK slot</Text>
            </View>
          )}
        </View>

        {/* Starter Outfield */}
        <View style={styles.positionSection}>
          <Text style={styles.positionLabel}>🏊 Field Players (6)</Text>
          {[...Array(6)].map((_, i) => 
            starterOutfield[i] ? (
              <View key={starterOutfield[i].id} style={styles.playerCardItem}>
                <View style={styles.playerCardInfo}>
                  <Text style={styles.playerCardName}>{starterOutfield[i].name}</Text>
                  <Text style={styles.playerCardDetails}>
                    {starterOutfield[i].team} • ${starterOutfield[i].price.toFixed(1)}M • {starterOutfield[i].points} pts
                  </Text>
                </View>
                <View style={styles.playerCardActions}>
                  <TouchableOpacity 
                    style={[
                      styles.captainBadge,
                      starterOutfield[i].id === captainId && styles.captainBadgeActive
                    ]}
                    onPress={() => !isLocked && handleSetCaptain(starterOutfield[i].id)}
                    disabled={isLocked}
                    activeOpacity={0.7}>
                    <Text style={[
                      styles.captainText,
                      starterOutfield[i].id === captainId && styles.captainTextActive
                    ]}>
                      {starterOutfield[i].id === captainId ? 'C (2×)' : 'C'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.toggleButton, isLocked && styles.disabledButton]}
                    onPress={() => handleToggleStarter(starterOutfield[i].id, true)}
                    disabled={isLocked}
                    activeOpacity={0.7}>
                    <Text style={styles.toggleButtonText}>→ Sub</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.removeButtonSmall, isLocked && styles.disabledButton]}
                    onPress={() => handleRemovePlayer(starterOutfield[i].id)}
                    disabled={isLocked}
                    activeOpacity={0.7}>
                    <Text style={styles.removeButtonSmallText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View key={`empty-starter-${i}`} style={styles.emptySlot}>
                <Text style={styles.emptySlotText}>Empty field player slot</Text>
              </View>
            )
          )}
        </View>
      </View>

      {/* Substitutes Section */}
      <View style={[styles.card, styles.subsCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Substitutes ({subCount}/5)</Text>
          <Text style={styles.formationIcon}>🔄</Text>
        </View>
        
        {/* Sub GK */}
        <View style={styles.positionSection}>
          <Text style={styles.positionLabel}>🥅 Goalkeeper (1)</Text>
          {subGK ? (
            <View style={styles.playerCardItem}>
              <View style={styles.playerCardInfo}>
                <Text style={styles.playerCardName}>{subGK.name}</Text>
                <Text style={styles.playerCardDetails}>
                  {subGK.team} • ${subGK.price.toFixed(1)}M • {subGK.points} pts
                </Text>
              </View>
              <View style={styles.playerCardActions}>
                <TouchableOpacity 
                  style={[styles.toggleButton, isLocked && styles.disabledButton]}
                  onPress={() => handleToggleStarter(subGK.id, false)}
                  disabled={isLocked}
                  activeOpacity={0.7}>
                  <Text style={styles.toggleButtonText}>→ Start</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.removeButtonSmall, isLocked && styles.disabledButton]}
                  onPress={() => handleRemovePlayer(subGK.id)}
                  disabled={isLocked}
                  activeOpacity={0.7}>
                  <Text style={styles.removeButtonSmallText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.emptySlot}>
              <Text style={styles.emptySlotText}>Empty GK slot</Text>
            </View>
          )}
        </View>

        {/* Sub Outfield */}
        <View style={styles.positionSection}>
          <Text style={styles.positionLabel}>🏊 Field Players (4)</Text>
          {[...Array(4)].map((_, i) => 
            subOutfield[i] ? (
              <View key={subOutfield[i].id} style={styles.playerCardItem}>
                <View style={styles.playerCardInfo}>
                  <Text style={styles.playerCardName}>{subOutfield[i].name}</Text>
                  <Text style={styles.playerCardDetails}>
                    {subOutfield[i].team} • ${subOutfield[i].price.toFixed(1)}M • {subOutfield[i].points} pts
                  </Text>
                </View>
                <View style={styles.playerCardActions}>
                  <TouchableOpacity 
                    style={[styles.toggleButton, isLocked && styles.disabledButton]}
                    onPress={() => handleToggleStarter(subOutfield[i].id, false)}
                    disabled={isLocked}
                    activeOpacity={0.7}>
                    <Text style={styles.toggleButtonText}>→ Start</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.removeButtonSmall, isLocked && styles.disabledButton]}
                    onPress={() => handleRemovePlayer(subOutfield[i].id)}
                    disabled={isLocked}
                    activeOpacity={0.7}>
                    <Text style={styles.removeButtonSmallText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View key={`empty-sub-${i}`} style={styles.emptySlot}>
                <Text style={styles.emptySlotText}>Empty field player slot</Text>
              </View>
            )
          )}
        </View>
      </View>

      {/* Position Summary */}
      <View style={[styles.card, styles.summaryCard]}>
        <Text style={styles.cardTitle}>Team Summary</Text>
        <View style={styles.positionRow}>
          <View style={styles.positionInfo}>
            <Text style={styles.positionIcon}>🥅</Text>
            <Text style={styles.positionName}>Goalkeepers</Text>
          </View>
          <View style={styles.positionCountBadge}>
            <Text style={styles.positionCount}>{gkCount} / 2</Text>
          </View>
        </View>
        <View style={styles.positionRow}>
          <View style={styles.positionInfo}>
            <Text style={styles.positionIcon}>🏊</Text>
            <Text style={styles.positionName}>Field Players</Text>
          </View>
          <View style={styles.positionCountBadge}>
            <Text style={styles.positionCount}>{outfieldCount} / 10</Text>
          </View>
        </View>
        <View style={styles.positionRow}>
          <View style={styles.positionInfo}>
            <Text style={styles.positionIcon}>⭐</Text>
            <Text style={styles.positionName}>Starters</Text>
          </View>
          <View style={styles.positionCountBadge}>
            <Text style={styles.positionCount}>{starterCount} / 7</Text>
          </View>
        </View>
        <View style={styles.positionRow}>
          <View style={styles.positionInfo}>
            <Text style={styles.positionIcon}>🔄</Text>
            <Text style={styles.positionName}>Substitutes</Text>
          </View>
          <View style={styles.positionCountBadge}>
            <Text style={styles.positionCount}>{subCount} / 5</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.primaryButton, isLocked && styles.disabledButton]}
          onPress={() => navigation.navigate('Players')}
          disabled={isLocked}
          activeOpacity={0.8}>
          <Text style={styles.buttonIcon}>➕</Text>
          <Text style={styles.primaryButtonText}>Add Players</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, isLocked && styles.disabledButton]}
          onPress={() => navigation.navigate('Transfers')}
          disabled={isLocked}
          activeOpacity={0.8}>
          <Text style={styles.buttonIcon}>🔄</Text>
          <Text style={styles.secondaryButtonText}>Make Transfers</Text>
        </TouchableOpacity>
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
    marginBottom: spacing.sm,
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
  budgetBadge: {
    backgroundColor: colors.oceanBright + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 2,
    borderColor: colors.oceanBright,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  budgetLabel: {
    fontSize: 12,
    color: colors.oceanBright,
    fontWeight: '600',
  },
  budgetAmount: {
    fontSize: 16,
    color: colors.white,
    fontWeight: 'bold',
  },
  spentText: {
    fontSize: 12,
    color: colors.oceanBright,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.large,
    ...shadows.medium,
    borderWidth: 1,
    borderColor: colors.oceanBright + '20',
  },
  formationCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.oceanMedium,
  },
  summaryCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.teal,
  },
  subsCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.turquoise,
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
  formationIcon: {
    fontSize: 24,
  },
  positionSection: {
    marginBottom: spacing.lg,
  },
  positionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.oceanDeep,
    marginBottom: spacing.sm,
  },
  playerCardItem: {
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.oceanBright + '40',
  },
  playerCardInfo: {
    flex: 1,
  },
  playerCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: spacing.xs,
  },
  playerCardDetails: {
    fontSize: 12,
    color: colors.textMuted,
  },
  playerCardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: colors.oceanMedium,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.small,
  },
  toggleButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  removeButtonSmall: {
    backgroundColor: '#FEE2E2',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  removeButtonSmallText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptySlot: {
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.textMuted + '40',
    alignItems: 'center',
  },
  emptySlotText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '20',
  },
  positionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  positionIcon: {
    fontSize: 20,
  },
  positionName: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
  },
  positionCountBadge: {
    backgroundColor: colors.oceanBright + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.oceanBright,
  },
  positionCount: {
    fontSize: 14,
    color: colors.oceanDeep,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: colors.oceanMedium,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.small,
  },
  buttonIcon: {
    fontSize: 18,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.oceanBright + '30',
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.oceanBright,
    ...shadows.small,
  },
  secondaryButtonText: {
    color: colors.oceanDeep,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
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
  captainBadge: {
    backgroundColor: colors.backgroundLight,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.textMuted,
  },
  captainBadgeActive: {
    backgroundColor: '#FCD34D',
    borderColor: '#F59E0B',
  },
  captainText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
  },
  captainTextActive: {
    color: '#92400E',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
