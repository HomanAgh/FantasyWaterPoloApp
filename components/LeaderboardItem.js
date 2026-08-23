import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';

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
        {entry.rank <= 3 ? (
          <Image source={Icons.badge} style={styles.rankEmoji} />
        ) : (
          <Text style={styles.rank}>{entry.rank}</Text>
        )}
      </View>
      <View style={styles.leaderboardInfo}>
        <Text style={[styles.leaderboardName, isCurrentUser && styles.currentUserName]}>
          {entry.team_name}
          {isCurrentUser && ' (You)'}
        </Text>
        <View style={styles.leaderboardMeta}>
          <View style={styles.pointsContainer}>
            <Text style={styles.leaderboardPoints}>{entry.total_points} pts</Text>
          </View>
          {entry.gameweeks_played > 0 && (
            <Text style={styles.gameweeksText}>
              {entry.gameweeks_played} GW{entry.gameweeks_played !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>
      {onKick ? (
        <TouchableOpacity style={styles.kickButton} onPress={onKick} hitSlop={8}>
          <Text style={styles.kickButtonText}>Kick</Text>
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
        activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.leaderboardItem,
        isCurrentUser && styles.currentUserItem,
      ]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '20',
  },
  currentUserItem: {
    backgroundColor: colors.oceanBright + '10',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.medium,
  },
  rankBadge: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    ...shadows.small,
  },
  rankGold: {
    backgroundColor: colors.sand + '30',
    borderWidth: 2,
    borderColor: colors.sand,
  },
  rankSilver: {
    backgroundColor: colors.pearl + '60',
    borderWidth: 2,
    borderColor: colors.oceanBright,
  },
  rankBronze: {
    backgroundColor: colors.coral + '20',
    borderWidth: 2,
    borderColor: colors.coral,
  },
  rankDefault: {
    backgroundColor: colors.oceanMedium + '40',
    borderWidth: 2,
    borderColor: colors.oceanBright,
  },
  rank: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  rankEmoji: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  currentUserName: {
    color: colors.oceanDeep,
    fontWeight: '700',
  },
  leaderboardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pointsContainer: {
    backgroundColor: colors.sand + '25',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.sand + '60',
  },
  leaderboardPoints: {
    fontSize: 14,
    color: colors.oceanDeep,
    fontWeight: '600',
  },
  gameweeksText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  kickButton: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.small,
    borderWidth: 1,
    borderColor: colors.coral,
    backgroundColor: colors.coral + '15',
  },
  kickButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.coral,
  },
});
