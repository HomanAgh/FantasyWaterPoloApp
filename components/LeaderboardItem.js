import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';

export default function LeaderboardItem({ entry, isCurrentUser, onKick, onLongPress }) {
  const getRankStyle = (rank) => {
    if (rank === 1) return styles.rankGold;
    if (rank === 2) return styles.rankSilver;
    if (rank === 3) return styles.rankBronze;
    return styles.rankDefault;
  };

  const content = (
    <>
      <View style={[styles.rankBadge, getRankStyle(entry.rank)]}>
        <Text style={styles.rank}>{entry.rank}</Text>
      </View>
      <View style={styles.leaderboardInfo}>
        <Text style={[styles.leaderboardName, isCurrentUser && styles.currentUserName]}>
          {entry.team_name}
          {isCurrentUser && ' (You)'}
        </Text>
        <View style={styles.leaderboardMeta}>
          <View style={styles.pointsContainer}>
            <Text style={styles.leaderboardPoints}>{entry.total_points} PTS</Text>
          </View>
          {entry.gameweeks_played > 0 && (
            <Text style={styles.gameweeksText}>
              {entry.gameweeks_played} GW{entry.gameweeks_played !== 1 ? 'S' : ''}
            </Text>
          )}
        </View>
      </View>
      {onKick ? (
        <TouchableOpacity style={styles.kickButton} onPress={onKick} hitSlop={8}>
          <Text style={styles.kickButtonText}>KICK</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );

  if (onLongPress) {
    return (
      <TouchableOpacity
        style={[
          styles.leaderboardItem,
          isCurrentUser && styles.currentUserItem,
        ]}
        onLongPress={onLongPress}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.leaderboardItem,
        isCurrentUser && styles.currentUserItem,
      ]}
    >
      {content}
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
    marginBottom: 2,
  },
  currentUserName: {
    color: colors.white,
    fontFamily: fonts.barlowCondensedSemiBold,
  },
  leaderboardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 13,
    color: colors.sand,
  },
  gameweeksText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 12,
    color: colors.auth.placeholder,
  },
  kickButton: {
    marginLeft: spacing.sm,
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
