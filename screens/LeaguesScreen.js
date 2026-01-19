import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';

export default function LeaguesScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>🏆</Text>
          <Text style={styles.title}>Leagues</Text>
          <Text style={styles.subtitle}>Compete with other managers</Text>
        </View>
      </View>

      {/* Create/Join League */}
      <View style={[styles.card, styles.actionsCard]}>
        <TouchableOpacity 
          style={styles.primaryButton}
          activeOpacity={0.8}>
          <Text style={styles.buttonIcon}>➕</Text>
          <Text style={styles.primaryButtonText}>Create League</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.secondaryButton}
          activeOpacity={0.8}>
          <Text style={styles.buttonIcon}>🔗</Text>
          <Text style={styles.secondaryButtonText}>Join League</Text>
        </TouchableOpacity>
      </View>

      {/* My Leagues */}
      <View style={[styles.card, styles.leaguesCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>My Leagues</Text>
          <Text style={styles.leaguesIcon}>👥</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🏊</Text>
          <Text style={styles.emptyText}>You're not in any leagues yet</Text>
          <Text style={styles.emptySubtext}>
            Create or join a league to compete with friends
          </Text>
        </View>
      </View>

      {/* Global Leaderboard */}
      <View style={[styles.card, styles.leaderboardCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Global Leaderboard</Text>
          <Text style={styles.leaderboardIcon}>📊</Text>
        </View>
        <View style={styles.leaderboardItem}>
          <View style={[styles.rankBadge, styles.rankGold]}>
            <Text style={styles.rank}>1</Text>
          </View>
          <View style={styles.leaderboardInfo}>
            <Text style={styles.leaderboardName}>Manager Name</Text>
            <View style={styles.pointsContainer}>
              <Text style={styles.leaderboardPoints}>0 points</Text>
            </View>
          </View>
        </View>
        <View style={styles.leaderboardItem}>
          <View style={[styles.rankBadge, styles.rankSilver]}>
            <Text style={styles.rank}>2</Text>
          </View>
          <View style={styles.leaderboardInfo}>
            <Text style={styles.leaderboardName}>Manager Name</Text>
            <View style={styles.pointsContainer}>
              <Text style={styles.leaderboardPoints}>0 points</Text>
            </View>
          </View>
        </View>
        <View style={styles.leaderboardItem}>
          <View style={[styles.rankBadge, styles.rankBronze]}>
            <Text style={styles.rank}>3</Text>
          </View>
          <View style={styles.leaderboardInfo}>
            <Text style={styles.leaderboardName}>Manager Name</Text>
            <View style={styles.pointsContainer}>
              <Text style={styles.leaderboardPoints}>0 points</Text>
            </View>
          </View>
        </View>
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
  headerEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.oceanBright,
    fontWeight: '500',
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
  actionsCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.oceanMedium,
  },
  leaguesCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.teal,
  },
  leaderboardCard: {
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
  leaguesIcon: {
    fontSize: 24,
  },
  leaderboardIcon: {
    fontSize: 24,
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
  buttonIcon: {
    fontSize: 18,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: colors.oceanDeep,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '20',
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
    backgroundColor: colors.warning + '30',
    borderWidth: 2,
    borderColor: colors.warning,
  },
  rankSilver: {
    backgroundColor: colors.textMuted + '30',
    borderWidth: 2,
    borderColor: colors.textMuted,
  },
  rankBronze: {
    backgroundColor: colors.coral + '30',
    borderWidth: 2,
    borderColor: colors.coral,
  },
  rank: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
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
  pointsContainer: {
    backgroundColor: colors.oceanBright + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    alignSelf: 'flex-start',
  },
  leaderboardPoints: {
    fontSize: 14,
    color: colors.oceanDeep,
    fontWeight: '600',
  },
});

