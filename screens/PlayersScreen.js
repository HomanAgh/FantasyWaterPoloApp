import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';

export default function PlayersScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('All');

  const positions = ['All', 'Goalkeeper', 'Field Player'];

  // Mock player data - replace with real data later
  const players = [
    {
      id: 1,
      name: 'Player Name',
      position: 'Goalkeeper',
      team: 'Team A',
      price: 5.0,
      points: 0,
    },
    {
      id: 2,
      name: 'Player Name',
      position: 'Field Player',
      team: 'Team B',
      price: 8.5,
      points: 0,
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>👥</Text>
          <Text style={styles.title}>Players</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.filterContainer}>
        <View style={styles.searchWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search players..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.positionFilter}>
          {positions.map((pos) => (
            <TouchableOpacity
              key={pos}
              style={[
                styles.filterChip,
                selectedPosition === pos && styles.filterChipActive,
              ]}
              onPress={() => setSelectedPosition(pos)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.filterChipText,
                  selectedPosition === pos && styles.filterChipTextActive,
                ]}>
                {pos}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Players List */}
      <View style={styles.playersList}>
        {players.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No players found</Text>
            <Text style={styles.emptySubtext}>
              Start by adding player data to your app
            </Text>
          </View>
        ) : (
          players.map((player) => (
            <TouchableOpacity 
              key={player.id} 
              style={styles.playerCard}
              activeOpacity={0.8}>
              <View style={styles.playerInfo}>
                <View style={styles.playerHeader}>
                  <Text style={styles.playerEmoji}>
                    {player.position === 'Goalkeeper' ? '🥅' : '🏊'}
                  </Text>
                  <Text style={styles.playerName}>{player.name}</Text>
                </View>
                <Text style={styles.playerDetails}>
                  {player.position} • {player.team}
                </Text>
              </View>
              <View style={styles.playerStats}>
                <View style={styles.priceBadge}>
                  <Text style={styles.playerPrice}>${player.price}M</Text>
                </View>
                <View style={styles.pointsBadge}>
                  <Text style={styles.playerPoints}>{player.points} pts</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
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
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  filterContainer: {
    backgroundColor: colors.white,
    padding: spacing.md,
    ...shadows.small,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '20',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.oceanBright + '40',
  },
  searchIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textDark,
  },
  positionFilter: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    backgroundColor: colors.backgroundLight,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: colors.oceanBright + '40',
  },
  filterChipActive: {
    backgroundColor: colors.oceanMedium,
    borderColor: colors.oceanMedium,
  },
  filterChipText: {
    fontSize: 14,
    color: colors.textMedium,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  playersList: {
    padding: spacing.md,
  },
  playerCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.small,
    borderLeftWidth: 4,
    borderLeftColor: colors.oceanMedium,
  },
  playerInfo: {
    flex: 1,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  playerEmoji: {
    fontSize: 20,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  playerDetails: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: spacing.md + spacing.xs,
  },
  playerStats: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  priceBadge: {
    backgroundColor: colors.oceanBright + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.oceanBright,
  },
  playerPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.oceanDeep,
  },
  pointsBadge: {
    backgroundColor: colors.teal + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  playerPoints: {
    fontSize: 14,
    color: colors.oceanDeep,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

