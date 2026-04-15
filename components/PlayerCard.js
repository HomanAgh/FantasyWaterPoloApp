import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, shadows, spacing } from '../styles/theme';

/**
 * PlayerCard Component
 * 
 * A reusable card component to display a player on the pitch.
 * Supports two modes: 'pickTeam' (for My Team screen) and 'transfers' (for Transfers screen).
 * 
 * @param {Object} props
 * @param {Object} props.player - Player object { id, name, position, team, price, points }
 * @param {boolean} props.isCaptain - Whether this player is the captain
 * @param {boolean} props.isStarter - Whether this player is in the starting lineup
 * @param {string} props.mode - Display mode: 'pickTeam' or 'transfers'
 * @param {function} props.onPress - Callback when card is pressed
 * @param {boolean} props.disabled - Whether the card is disabled (for locked rounds)
 */
const PlayerCard = ({ 
    player, 
    isCaptain = false, 
    isStarter = true, 
    mode = 'pickTeam', 
    onPress, 
    disabled = false 
  }) => {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {/* Captain Badge */}
        {isCaptain && (
          <View style={styles.captainBadge}>
            <Text style={styles.captainBadgeText}>C</Text>
          </View>
        )}
        
        {/* Jersey/Avatar Circle */}
        <View style={[
          styles.jerseyCircle, 
          isStarter ? styles.jerseyCircleStarter : styles.jerseyCircleSub,
          isCaptain && styles.captainCircle,
          disabled && styles.disabledCircle
        ]}>
          <Text style={styles.jerseyEmoji}>
            {player.position === 'GK' ? '🥅' : '🏊'}
          </Text>
        </View>
        
        {/* Player Name */}
        <Text 
          style={[
            styles.playerName, 
            isStarter ? styles.starterText : styles.substituteText
          ]} 
          numberOfLines={2}
        >
          {player.name}
        </Text>
        
        {/* Display price in transfers mode, points in pick team mode */}
        {mode === 'transfers' ? (
          <Text style={[styles.valueText, isStarter ? styles.starterText : styles.substituteText]}>
            ${player.price.toFixed(1)}M
          </Text>
        ) : (
          <Text style={[styles.valueText, isStarter ? styles.starterText : styles.substituteText]}>
            {player.points} pts
          </Text>
        )}
      </TouchableOpacity>
    );
  };
  
  const styles = StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 65,
      position: 'relative',
    },
    captainBadge: {
      position: 'absolute',
      top: -4,
      right: 8,
      backgroundColor: '#FCD34D',
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#F59E0B',
      zIndex: 10,
      ...shadows.medium,
    },
    captainBadgeText: {
      color: '#92400E',
      fontSize: 11,
      fontWeight: 'bold',
    },
    jerseyCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      borderWidth: 2,
      ...shadows.small,
    },
    jerseyCircleStarter: {
      backgroundColor: colors.white,
      borderColor: colors.oceanMedium,
    },
    jerseyCircleSub: {
      backgroundColor: colors.backgroundLight,
      borderColor: colors.textMuted,
    },
    captainCircle: {
      borderColor: '#F59E0B',
      borderWidth: 3,
      ...shadows.medium,
    },
    disabledCircle: {
      opacity: 0.5,
    },
    jerseyEmoji: {
      fontSize: 24,
    },
    playerName: {
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 2,
      lineHeight: 12,
      width: '100%',
    },
    starterText: {
      color: colors.pearl,
    },
    substituteText: {
      color: colors.pearl,
    },
    valueText: {
      fontSize: 9,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  });
  
  export default React.memo(PlayerCard);
