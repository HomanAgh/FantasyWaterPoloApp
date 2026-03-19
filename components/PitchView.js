import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import PlayerCard from './PlayerCard';

/**
 * PitchView Component
 * 
 * Main pitch visualization component that displays the team in a water polo formation.
 * Layout: 1 GK at back, 6 Outfield players in 2 rows of 3, and 5 substitutes on the bench.
 * 
 * @param {Object} props
 * @param {Array} props.players - Array of player objects (all 12 players)
 * @param {string} props.captainId - ID of the captain player
 * @param {string} props.mode - Display mode: 'pickTeam' or 'transfers'
 * @param {function} props.onPlayerPress - Callback when a player card is pressed (playerId, player)
 * @param {function} props.onEmptySlotPress - Callback when an empty slot is pressed (position, isStarter)
 * @param {boolean} props.isLocked - Whether the round is locked (disables interactions)
 */
const PitchView = ({ 
  players = [], 
  captainId = null, 
  mode = 'pickTeam', 
  onPlayerPress, 
  onEmptySlotPress,
  isLocked = false 
}) => {
  // Separate players by position and starter status
  const starters = players.filter(p => p.isStarter);
  const substitutes = players.filter(p => !p.isStarter);
  
  const starterGK = starters.find(p => p.position === 'GK');
  const starterOutfield = starters.filter(p => p.position === 'Outfield');
  
  const subGK = substitutes.find(p => p.position === 'GK');
  const subOutfield = substitutes.filter(p => p.position === 'Outfield');
  
  // Create arrays with empty slots for missing players
  const starterOutfieldSlots = [...Array(6)].map((_, i) => starterOutfield[i] || null);
  const subOutfieldSlots = [...Array(4)].map((_, i) => subOutfield[i] || null);
  
  /**
   * Render an empty slot with dashed border
   */
  const renderEmptySlot = (position, isStarter) => (
    <TouchableOpacity
      style={[
        styles.emptySlot,
        isStarter ? styles.emptySlotStarter : styles.emptySlotSub
      ]}
      onPress={() => !isLocked && onEmptySlotPress && onEmptySlotPress(position, isStarter)}
      disabled={isLocked}
      activeOpacity={0.7}
    >
      <View style={styles.emptySlotCircle}>
        <Text style={styles.emptySlotEmoji}>
          {position === 'GK' ? '🥅' : '🏊'}
        </Text>
      </View>
      <Text style={styles.emptySlotText}>Empty</Text>
    </TouchableOpacity>
  );
  
  /**
   * Render a player card or empty slot
   */
  const renderPlayerOrEmpty = (player, position, isStarter) => {
    if (player) {
      return (
        <PlayerCard
          player={player}
          isCaptain={mode !== 'transfers' && player.id === captainId}
          isStarter={isStarter}
          mode={mode}
          onPress={() => !isLocked && onPlayerPress && onPlayerPress(player.id, player)}
          disabled={isLocked}
        />
      );
    }
    return renderEmptySlot(position, isStarter);
  };
  
  // Render compact layout for transfers mode (all players grouped together)
  if (mode === 'transfers') {
    const allGKs = players.filter(p => p.position === 'GK');
    const allOutfield = players.filter(p => p.position === 'Outfield');
    
    // Create slots for missing players
    const gkSlots = [...Array(2)].map((_, i) => allGKs[i] || null);
    const outfieldSlots = [...Array(10)].map((_, i) => allOutfield[i] || null);
    
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.pitch}>
          <Text style={styles.sectionTitle}>MY SQUAD (12)</Text>
          
          {/* Goalkeepers Row */}
          <View style={styles.compactRow}>
            {gkSlots.map((player, index) => (
              <View key={player?.id || `gk-${index}`} style={styles.playerSlot}>
                {renderPlayerOrEmpty(player, 'GK', true)}
              </View>
            ))}
          </View>
          
          {/* Outfield Row 1 - 5 players */}
          <View style={styles.compactRow}>
            {outfieldSlots.slice(0, 5).map((player, index) => (
              <View key={player?.id || `of-${index}`} style={styles.playerSlot}>
                {renderPlayerOrEmpty(player, 'Outfield', true)}
              </View>
            ))}
          </View>
          
          {/* Outfield Row 2 - 5 players */}
          <View style={styles.compactRow}>
            {outfieldSlots.slice(5, 10).map((player, index) => (
              <View key={player?.id || `of-${index + 5}`} style={styles.playerSlot}>
                {renderPlayerOrEmpty(player, 'Outfield', true)}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }
  
  // Default pickTeam mode - tactical formation layout
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Pitch Background */}
      <View style={styles.pitch}>
        {/* Starters Section */}
        <View style={styles.startersSection}>
          <Text style={styles.sectionTitle}>STARTING LINEUP</Text>
          
          {/* Goalkeeper Row */}
          <View style={styles.gkRow}>
            <View style={styles.playerSlot}>
              {renderPlayerOrEmpty(starterGK, 'GK', true)}
            </View>
          </View>
          
          {/* Outfield Row 1 - 3 players */}
          <View style={styles.outfieldRow}>
            {starterOutfieldSlots.slice(0, 3).map((player, index) => (
              <View key={player?.id || `starter-of-${index}`} style={styles.playerSlot}>
                {renderPlayerOrEmpty(player, 'Outfield', true)}
              </View>
            ))}
          </View>
          
          {/* Outfield Row 2 - 3 players */}
          <View style={styles.outfieldRow}>
            {starterOutfieldSlots.slice(3, 6).map((player, index) => (
              <View key={player?.id || `starter-of-${index + 3}`} style={styles.playerSlot}>
                {renderPlayerOrEmpty(player, 'Outfield', true)}
              </View>
            ))}
          </View>
        </View>
        
        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>BENCH</Text>
          <View style={styles.dividerLine} />
        </View>
        
        {/* Substitutes Section */}
        <View style={styles.substitutesSection}>
          <View style={styles.benchRow}>
            {/* Sub GK */}
            <View style={styles.playerSlot}>
              {renderPlayerOrEmpty(subGK, 'GK', false)}
            </View>
            
            {/* Sub Outfield - 4 players */}
            {subOutfieldSlots.map((player, index) => (
              <View key={player?.id || `sub-of-${index}`} style={styles.playerSlot}>
                {renderPlayerOrEmpty(player, 'Outfield', false)}
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing.xl,
  },
  pitch: {
    backgroundColor: colors.oceanDeep,
    margin: spacing.md,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    ...shadows.large,
    borderWidth: 2,
    borderColor: colors.oceanMedium,
  },
  startersSection: {
    paddingVertical: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: 1,
  },
  gkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  outfieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  playerSlot: {
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.white + '40',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.white,
    marginHorizontal: spacing.md,
    letterSpacing: 1,
  },
  substitutesSection: {
    paddingVertical: spacing.md,
  },
  benchRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xs,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
    flexWrap: 'wrap',
  },
  emptySlot: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.medium,
    minWidth: 70,
    minHeight: 100,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  emptySlotStarter: {
    borderColor: colors.white + '60',
    backgroundColor: colors.oceanMedium + '20',
  },
  emptySlotSub: {
    borderColor: colors.white + '40',
    backgroundColor: colors.oceanDeep + '40',
  },
  emptySlotCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
    backgroundColor: colors.oceanDeep + '60',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.white + '40',
  },
  emptySlotEmoji: {
    fontSize: 24,
    opacity: 0.5,
  },
  emptySlotText: {
    fontSize: 10,
    color: colors.white + 'CC',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default React.memo(PitchView);
