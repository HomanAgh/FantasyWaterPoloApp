import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';

export default function LeaderboardItem({
  entry,
  isCurrentUser,
  onKick,
  onLongPress,
  onViewTeam,
}) {
  const getRankStyle = (rank) => {
    if (rank === 1) return styles.rankGold;
    if (rank === 2) return styles.rankSilver;
    if (rank === 3) return styles.rankBronze;
    return styles.rankDefault;
  };

  const main = (
    <>
      <View style={[styles.rankBadge, getRankStyle(entry.rank)]}>
        <Text style={styles.rank}>{entry.rank}</Text>
      </View>
      <View style={styles.leaderboardInfo}>
        <Text
          style={[styles.leaderboardName, isCurrentUser && styles.currentUserName]}
          numberOfLines={1}
        >
          {entry.team_name}
          {isCurrentUser && ' (You)'}
        </Text>
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.leaderboardItem,
        isCurrentUser && styles.currentUserItem,
      ]}
    >
      {onLongPress ? (
        <TouchableOpacity
          style={styles.mainPressable}
          onLongPress={onLongPress}
          delayLongPress={400}
          activeOpacity={0.7}
        >
          {main}
        </TouchableOpacity>
      ) : (
        <View style={styles.mainPressable}>{main}</View>
      )}

      <View style={styles.trailingActions}>
        <View style={styles.pointsContainer}>
          <Text style={styles.leaderboardPoints}>{entry.total_points} PTS</Text>
        </View>

        {onViewTeam ? (
          <TouchableOpacity
            style={styles.viewButton}
            onPress={onViewTeam}
            hitSlop={8}
            activeOpacity={0.7}
            accessibilityLabel={`View ${entry.team_name}`}
          >
            <Image source={Icons.teameye} style={styles.viewIcon} />
          </TouchableOpacity>
        ) : null}

        {onKick ? (
          <TouchableOpacity style={styles.kickButton} onPress={onKick} hitSlop={8}>
            <Text style={styles.kickButtonText}>KICK</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.auth.neonSoft,
  },
  currentUserItem: {
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.small,
  },
  mainPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  rankGold: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderWidth: 0.5,
    borderColor: colors.sand,
  },
  rankSilver: {
    backgroundColor: 'rgba(0, 174, 239, 0.12)',
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  rankBronze: {
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
    borderWidth: 0.5,
    borderColor: colors.coral,
  },
  rankDefault: {
    backgroundColor: colors.auth.inputBg,
    borderWidth: 0.5,
    borderColor: colors.auth.neonSoft,
  },
  rank: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 24,
    color: colors.white,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.white,
  },
  currentUserName: {
    color: colors.white,
    fontFamily: fonts.barlowCondensedSemiBold,
  },
  // Gap between points / eye / kick — tweak this
  trailingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
    gap: spacing.sm,
  },
  pointsContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.small,
    borderWidth: 0.5,
    borderColor: colors.sand,
  },
  leaderboardPoints: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 16,
    color: colors.sand,
  },
  viewButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.small,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    backgroundColor: 'rgba(0, 174, 239, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: colors.auth.neon,
  },
  kickButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.small,
    borderWidth: 0.5,
    borderColor: colors.coral,
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
  },
  kickButtonText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 12,
    color: colors.coral,
    letterSpacing: 0.5,
  },
});
