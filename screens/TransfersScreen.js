import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';

export default function TransfersScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>🔄</Text>
          <Text style={styles.title}>Transfers</Text>
          <Text style={styles.subtitle}>Make changes to your team</Text>
        </View>
      </View>

      {/* Transfer Info */}
      <View style={[styles.card, styles.rulesCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Transfer Rules</Text>
          <Text style={styles.rulesIcon}>📋</Text>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleBullet}>💧</Text>
          <Text style={styles.ruleText}>Free transfers available: Unlimited</Text>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleBullet}>⏰</Text>
          <Text style={styles.ruleText}>Transfer deadline: Before match start</Text>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleBullet}>💰</Text>
          <Text style={styles.ruleText}>Budget: $100.0M</Text>
        </View>
      </View>

      {/* Current Team */}
      <View style={[styles.card, styles.teamCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Current Team</Text>
          <Text style={styles.teamIcon}>🏊</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyText}>No players in your team yet</Text>
        </View>
        <TouchableOpacity style={styles.button} activeOpacity={0.8}>
          <Text style={styles.buttonIcon}>➕</Text>
          <Text style={styles.buttonText}>Select Players</Text>
        </TouchableOpacity>
      </View>

      {/* Transfer History */}
      <View style={[styles.card, styles.historyCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recent Transfers</Text>
          <Text style={styles.historyIcon}>📜</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyText}>No transfers made yet</Text>
          <Text style={styles.emptySubtext}>Your transfer history will appear here</Text>
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
  rulesCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.oceanMedium,
  },
  teamCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.teal,
  },
  historyCard: {
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
  rulesIcon: {
    fontSize: 24,
  },
  teamIcon: {
    fontSize: 24,
  },
  historyIcon: {
    fontSize: 24,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  ruleBullet: {
    fontSize: 20,
  },
  ruleText: {
    fontSize: 16,
    color: colors.textMedium,
    lineHeight: 24,
    flex: 1,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.oceanMedium,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.small,
  },
  buttonIcon: {
    fontSize: 18,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
