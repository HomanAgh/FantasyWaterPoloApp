import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';

export default function MyTeamScreen({ navigation }) {
  const teamPositions = [
    { position: 'Goalkeeper', count: 0, max: 1 },
    { position: 'Field Players', count: 0, max: 6 },
    { position: 'Substitutes', count: 0, max: 5 },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.teamEmoji}>🏊</Text>
          <Text style={styles.title}>My Fantasy Team</Text>
          <View style={styles.budgetBadge}>
            <Text style={styles.budgetLabel}>Budget</Text>
            <Text style={styles.budgetAmount}>$100.0M</Text>
          </View>
        </View>
      </View>

      {/* Team Formation */}
      <View style={[styles.card, styles.formationCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Formation</Text>
          <Text style={styles.formationIcon}>⚽</Text>
        </View>
        <View style={styles.formationContainer}>
          <View style={styles.pool}>
            <Text style={styles.poolIcon}>🏊‍♂️</Text>
            <Text style={styles.poolLabel}>Pool</Text>
          </View>
          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <View style={[styles.playerSlot, styles.goalkeeperSlot]}>
                <Text style={styles.playerSlotEmoji}>🥅</Text>
                <Text style={styles.playerSlotText}>GK</Text>
              </View>
            </View>
            <View style={styles.fieldRow}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[styles.playerSlot, styles.fieldPlayerSlot]}>
                  <Text style={styles.playerSlotEmoji}>🏊</Text>
                  <Text style={styles.playerSlotText}>FP</Text>
                </View>
              ))}
            </View>
            <View style={styles.fieldRow}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[styles.playerSlot, styles.fieldPlayerSlot]}>
                  <Text style={styles.playerSlotEmoji}>🏊</Text>
                  <Text style={styles.playerSlotText}>FP</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Position Summary */}
      <View style={[styles.card, styles.summaryCard]}>
        <Text style={styles.cardTitle}>Team Summary</Text>
        {teamPositions.map((pos, index) => (
          <View key={index} style={styles.positionRow}>
            <View style={styles.positionInfo}>
              <Text style={styles.positionIcon}>
                {index === 0 ? '🥅' : index === 1 ? '🏊' : '🔄'}
              </Text>
              <Text style={styles.positionName}>{pos.position}</Text>
            </View>
            <View style={styles.positionCountBadge}>
              <Text style={styles.positionCount}>
                {pos.count} / {pos.max}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Players')}
          activeOpacity={0.8}>
          <Text style={styles.buttonIcon}>➕</Text>
          <Text style={styles.primaryButtonText}>Add Players</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Transfers')}
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
  formationContainer: {
    alignItems: 'center',
  },
  pool: {
    width: '100%',
    height: 70,
    backgroundColor: colors.oceanBright + '20',
    borderRadius: borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.oceanBright,
    borderStyle: 'dashed',
  },
  poolIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  poolLabel: {
    fontSize: 16,
    color: colors.oceanDeep,
    fontWeight: '700',
  },
  field: {
    width: '100%',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  playerSlot: {
    width: 85,
    height: 85,
    borderRadius: borderRadius.medium,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  goalkeeperSlot: {
    backgroundColor: colors.oceanBright + '20',
    borderColor: colors.oceanMedium,
  },
  fieldPlayerSlot: {
    backgroundColor: colors.teal + '20',
    borderColor: colors.teal,
  },
  playerSlotEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  playerSlotText: {
    fontSize: 12,
    color: colors.oceanDeep,
    fontWeight: '700',
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
});
