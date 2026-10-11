import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, fonts } from '../styles/theme';

/**
 * PlayerCard — circular avatar + name + points/price for the pitch.
 * Auto-sub: wasAutoSub → OUT (starter blank, points from bench);
 *           autoSubbedIn → IN (bench points counted in XI total).
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
  const autoSubLabel = player.wasAutoSub
    ? 'OUT'
    : player.autoSubbedIn
      ? 'IN'
      : null;
  // Prefer IN over bench order / GK when this player was used in auto-sub
  const rightBadge = autoSubLabel === 'IN' ? 'IN' : !isCaptain ? benchBadge : null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrap}>
        {autoSubLabel === 'OUT' && (
          <View style={styles.autoSubBadge}>
            <Text style={styles.autoSubBadgeText}>OUT</Text>
          </View>
        )}
        {isCaptain && (
          <View style={styles.captainBadge}>
            <Text style={styles.captainBadgeText}>C</Text>
          </View>
        )}
        {rightBadge != null && (
          <View
            style={rightBadge === 'IN' ? styles.autoSubBadgeRight : styles.benchBadge}
          >
            <Text
              style={
                rightBadge === 'IN' ? styles.autoSubBadgeText : styles.benchBadgeText
              }
            >
              {rightBadge}
            </Text>
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
  autoSubBadge: {
    position: 'absolute',
    top: -2,
    left: -4,
    backgroundColor: colors.sand,
    minWidth: 28,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: colors.oceanDeep,
  },
  autoSubBadgeRight: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: colors.sand,
    minWidth: 24,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: colors.oceanDeep,
  },
  autoSubBadgeText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    color: colors.oceanDeep,
    fontSize: 9,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    width: 34,
    height: 34,
    resizeMode: 'contain',
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
