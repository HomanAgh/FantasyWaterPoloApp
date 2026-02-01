import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { fetchPlayers } from '../services/playerService';

export default function HomeScreen({ navigation }) {
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayerStats();
  }, []);

  const loadPlayerStats = async () => {
    setLoading(true);
    const { data, error } = await fetchPlayers();
    
    if (!error && data) {
      setPlayerCount(data.length);
    }
    
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Ocean-themed header with gradient effect */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.waveEmoji}>🌊</Text>
          <Text style={styles.title}>Fantasy Water Polo</Text>
          <Text style={styles.subtitle}>Dive into the action!</Text>
        </View>
      </View>

      {/* Points Summary Card with ocean accent */}
      <View style={[styles.card, styles.pointsCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>This Week's Points</Text>
          <Text style={styles.waveIcon}>💧</Text>
        </View>
        <View style={styles.pointsContainer}>
          <Text style={styles.points}>0</Text>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsBadgeText}>Total: 0</Text>
          </View>
        </View>
      </View>

      {/* Team Overview Card */}
      <View style={[styles.card, styles.teamCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>My Team</Text>
          <Text style={styles.teamIcon}>🏊</Text>
        </View>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.oceanMedium} />
          </View>
        ) : (
          <>
            <Text style={styles.cardSubtext}>0 players selected</Text>
            <Text style={styles.cardInfo}>
              {playerCount} players available in database
            </Text>
          </>
        )}
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('MyTeam')}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>View Team</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions with ocean colors */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButton1]}
          onPress={() => navigation.navigate('Players')}
          activeOpacity={0.8}>
          <Text style={styles.actionButtonIcon}>👥</Text>
          <Text style={styles.actionButtonText}>Browse Players</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButton2]}
          onPress={() => navigation.navigate('Transfers')}
          activeOpacity={0.8}>
          <Text style={styles.actionButtonIcon}>🔄</Text>
          <Text style={styles.actionButtonText}>Make Transfers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButton3]}
          onPress={() => navigation.navigate('Leagues')}
          activeOpacity={0.8}>
          <Text style={styles.actionButtonIcon}>🏆</Text>
          <Text style={styles.actionButtonText}>Join League</Text>
        </TouchableOpacity>
      </View>

      {/* Upcoming Fixtures */}
      <View style={[styles.card, styles.fixturesCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Upcoming Fixtures</Text>
          <Text style={styles.fixtureIcon}>📅</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No fixtures scheduled</Text>
          <Text style={styles.emptySubtext}>Check back soon for matches!</Text>
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
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...shadows.large,
  },
  headerContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  waveEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 5,
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
  pointsCard: {
    backgroundColor: colors.white,
    borderLeftWidth: 4,
    borderLeftColor: colors.oceanMedium,
  },
  teamCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.teal,
  },
  fixturesCard: {
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
  waveIcon: {
    fontSize: 24,
  },
  teamIcon: {
    fontSize: 24,
  },
  fixtureIcon: {
    fontSize: 24,
  },
  pointsContainer: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  points: {
    fontSize: 64,
    fontWeight: 'bold',
    color: colors.oceanMedium,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pointsBadge: {
    backgroundColor: colors.oceanBright + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.oceanBright,
  },
  pointsBadgeText: {
    fontSize: 14,
    color: colors.oceanDeep,
    fontWeight: '600',
  },
  cardSubtext: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.oceanMedium,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginTop: spacing.md,
    ...shadows.small,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginTop: spacing.sm,
    ...shadows.small,
  },
  actionButton1: {
    backgroundColor: colors.oceanBright + '30',
    borderWidth: 2,
    borderColor: colors.oceanBright,
  },
  actionButton2: {
    backgroundColor: colors.teal + '30',
    borderWidth: 2,
    borderColor: colors.teal,
  },
  actionButton3: {
    backgroundColor: colors.turquoise + '30',
    borderWidth: 2,
    borderColor: colors.turquoise,
  },
  actionButtonIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  actionButtonText: {
    color: colors.oceanDeep,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cardInfo: {
    fontSize: 14,
    color: colors.oceanMedium,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontWeight: '600',
  },
});

