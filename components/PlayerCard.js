import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, fonts } from '../styles/theme';

/**
 * PlayerCard — circular avatar + name + points/price for the pitch.
 */
const PlayerCard = ({
  player,
  isCaptain = false,
  isStarter = true,
  mode = 'pickTeam',
  benchBadge = null,
  onPress,
  disabled = false,
}) => {
  const avatar = player.position === 'GK' ? Icons.goalie : Icons.player1;
  const rawPoints = player.points ?? 0;
  const displayPoints = isCaptain ? rawPoints * 2 : rawPoints;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrap}>
        {isCaptain && (
          <View style={styles.captainBadge}>
            <Text style={styles.captainBadgeText}>C</Text>
          </View>
        )}
        {benchBadge != null && !isCaptain && (
          <View style={styles.benchBadge}>
            <Text style={styles.benchBadgeText}>{benchBadge}</Text>
          </View>
        )}

        <View
          style={[
            styles.jerseyCircle,
            isStarter ? styles.jerseyCircleStarter : styles.jerseyCircleSub,
            isCaptain && styles.captainCircle,
            disabled && styles.disabledCircle,
          ]}
        >
          <Image source={avatar} style={styles.jerseyEmoji} />
        </View>
      </View>

      <Text style={styles.playerName} numberOfLines={2}>
        {(player.name || '').toUpperCase()}
      </Text>

      {mode === 'transfers' ? (
        <Text style={styles.valueText}>${player.price.toFixed(1)}M</Text>
      ) : (
        <Text style={styles.valueText}>{displayPoints} PTS</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    position: 'relative',
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  captainBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.sand,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: colors.oceanDeep,
  },
  captainBadgeText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    color: colors.oceanDeep,
    fontSize: 11,
  },
  benchBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.auth.neon,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: colors.oceanDeep,
  },
  benchBadgeText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    color: colors.white,
    fontSize: 9,
  },
  jerseyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  jerseyCircleStarter: {
    borderColor: colors.auth.neon,
  },
  jerseyCircleSub: {
    borderColor: colors.auth.neon,
  },
  captainCircle: {
    borderColor: colors.sand,
    borderWidth: 2.5,
  },
  disabledCircle: {
    opacity: 0.55,
  },
  jerseyEmoji: {
    width: 56,
    height: 56,
    borderRadius: 28,
    resizeMode: 'cover',
  },
  playerName: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 9,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 11,
    width: '100%',
    letterSpacing: 0.2,
  },
  valueText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 11,
    color: colors.white,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

export default React.memo(PlayerCard);
