import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { searchAndFilterPlayers } from '../services/playerService';
import { useTeam } from '../context/TeamContext';
import { useRound } from '../context/RoundContext';
import * as playerRoundPointsService from '../services/playerRoundPointsService';

export default function PlayersScreen({ navigation, route }) {
  // Get navigation params
  const replacingPlayer = route?.params?.replacingPlayer;
  const filterPosition = route?.params?.filterPosition;
  const mode = route?.params?.mode || 'add'; // 'add' or 'replace'

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState(() => {
    // Auto-filter by position if replacing
    if (filterPosition === 'GK') return 'Goalkeeper';
    if (filterPosition === 'Outfield') return 'Field Player';
    return 'All';
  });
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const positions = ['All', 'Goalkeeper', 'Field Player'];

  // Get team state from context
  const { 
    selectedPlayers, 
    addPlayer, 
    removePlayer, 
    remainingBudget,
    canAddPlayer 
  } = useTeam();

  // Get round info from context
  const { currentRound, isLocked } = useRound();

  // Fetch players on mount and when filters change
  useEffect(() => {
    loadPlayers();
  }, [selectedPosition]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPlayers();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const loadPlayers = async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await searchAndFilterPlayers(
      searchQuery,
      selectedPosition
    );

    if (fetchError) {
      setError('Failed to load players. Please check your connection.');
      setPlayers([]);
      setLoading(false);
      return;
    }

    // Enrich players with gameweek points if round is available
    if (currentRound && data && data.length > 0) {
      const playerIds = data.map(p => p.id);
      const { data: pointsMap } = await playerRoundPointsService
        .getMultiplePlayersPointsForRound(playerIds, currentRound.id);
      
      const enrichedPlayers = data.map(p => ({
        ...p,
        gwPoints: pointsMap[p.id] || 0
      }));
      
      setPlayers(enrichedPlayers);
    } else {
      setPlayers(data || []);
    }

    setLoading(false);
  };

  const handleAddPlayer = async (player) => {
    setErrorMessage('');
    
    // If replacing, first remove the old player
    if (mode === 'replace' && replacingPlayer) {
      await removePlayer(replacingPlayer.id);
    }
    
    const result = await addPlayer(player);
    
    if (!result.success) {
      setErrorMessage(result.error || 'Failed to add player');
      // Clear error after 5 seconds
      setTimeout(() => setErrorMessage(''), 5000);
    } else {
      // Navigate back to Transfers screen after successful add/replace
      if (mode === 'replace') {
        navigation.navigate('Transfers');
      }
    }
  };

  const handleRemovePlayer = async (playerId) => {
    setErrorMessage('');
    await removePlayer(playerId);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>👥</Text>
          <Text style={styles.title}>
            {mode === 'replace' && replacingPlayer
              ? 'Select Replacement'
              : 'Players'}
          </Text>
          {mode === 'replace' && replacingPlayer && (
            <View style={styles.replacementBanner}>
              <Text style={styles.replacementText}>
                Replacing: {replacingPlayer.name}
              </Text>
              <Text style={styles.replacementSubtext}>
                ({replacingPlayer.position}) • ${replacingPlayer.price.toFixed(1)}M
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Team Info Banner */}
      <View style={styles.teamInfoBanner}>
        <View style={styles.teamInfoItem}>
          <Text style={styles.teamInfoLabel}>Team</Text>
          <Text style={styles.teamInfoValue}>{selectedPlayers.length}/12</Text>
        </View>
        <View style={styles.teamInfoDivider} />
        <View style={styles.teamInfoItem}>
          <Text style={styles.teamInfoLabel}>Budget</Text>
          <Text style={styles.budgetValue}>${remainingBudget.toFixed(1)}M</Text>
        </View>
      </View>

      {/* Locked Banner */}
      {isLocked && currentRound && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <Text style={styles.lockedText}>
            Transfers locked - Gameweek {currentRound.round_number} in progress
          </Text>
        </View>
      )}

      {/* Error Message */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ {errorMessage}</Text>
        </View>
      ) : null}

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
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.oceanMedium} />
            <Text style={styles.loadingText}>Loading players...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadPlayers}
              activeOpacity={0.7}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : players.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No players found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || selectedPosition !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Start by adding player data to your database'}
            </Text>
          </View>
        ) : (
          players.map((player) => {
            // Map DB position to UI labels
            const displayPosition =
              player.position === 'GK' ? 'Goalkeeper' : 'Field Player';
            const isInTeam = selectedPlayers.some(p => p.id === player.id);
            const canAdd = canAddPlayer(player);
            
            return (
              <View
                key={player.id}
                style={styles.playerCard}>
                <View style={styles.playerInfo}>
                  <View style={styles.playerHeader}>
                    <Text style={styles.playerEmoji}>
                      {player.position === 'GK' ? '🥅' : '🏊'}
                    </Text>
                    <Text style={styles.playerName}>{player.name}</Text>
                  </View>
                  <Text style={styles.playerDetails}>
                    {displayPosition} • {player.team}
                  </Text>
                  {currentRound && player.gwPoints !== undefined && (
                    <Text style={styles.gameweekPoints}>
                      GW{currentRound.round_number}: {player.gwPoints} pts
                    </Text>
                  )}
                </View>
                <View style={styles.playerStats}>
                  <View style={styles.priceBadge}>
                    <Text style={styles.playerPrice}>${player.price.toFixed(1)}M</Text>
                  </View>
                  <View style={styles.pointsBadge}>
                    <Text style={styles.playerPoints}>{player.points} pts</Text>
                  </View>
                </View>
                
                {/* Add/Remove Button */}
                <View style={styles.actionButtonContainer}>
                  {isInTeam ? (
                    <TouchableOpacity 
                      style={[styles.removeButton, isLocked && styles.disabledButton]}
                      onPress={() => handleRemovePlayer(player.id)}
                      disabled={isLocked}
                      activeOpacity={0.7}>
                      <Text style={[styles.removeButtonText, isLocked && styles.disabledButtonText]}>
                        ✓ In Team
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.addButton, (!canAdd || isLocked) && styles.disabledButton]}
                      onPress={() => handleAddPlayer(player)}
                      disabled={!canAdd || isLocked}
                      activeOpacity={0.7}>
                      <Text style={[styles.addButtonText, (!canAdd || isLocked) && styles.disabledButtonText]}>
                        {isLocked 
                          ? 'Locked' 
                          : mode === 'replace' 
                            ? (canAdd ? 'Replace' : 'Cannot Replace')
                            : (canAdd ? '+ Add' : 'Cannot Add')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
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
  teamInfoBanner: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadows.small,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '20',
  },
  teamInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  teamInfoDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.oceanBright + '40',
  },
  teamInfoLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  teamInfoValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.oceanDeep,
  },
  budgetValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.teal,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  errorBannerText: {
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '600',
    textAlign: 'center',
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
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  errorContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.oceanMedium,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    ...shadows.small,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  actionButtonContainer: {
    marginTop: spacing.sm,
    width: '100%',
  },
  addButton: {
    backgroundColor: colors.oceanMedium,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    ...shadows.small,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  removeButton: {
    backgroundColor: colors.teal + '30',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.teal,
  },
  removeButtonText: {
    color: colors.oceanDeep,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.textMuted + '40',
  },
  disabledButtonText: {
    color: colors.textMuted,
  },
  lockedBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  lockedIcon: {
    fontSize: 20,
  },
  lockedText: {
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '700',
  },
  gameweekPoints: {
    fontSize: 13,
    color: colors.oceanMedium,
    fontWeight: '600',
    marginLeft: spacing.md + spacing.xs,
    marginTop: spacing.xs,
  },
  replacementBanner: {
    backgroundColor: colors.oceanBright + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.medium,
    marginTop: spacing.sm,
    borderWidth: 2,
    borderColor: colors.oceanBright,
    alignItems: 'center',
  },
  replacementText: {
    fontSize: 14,
    color: colors.white,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  replacementSubtext: {
    fontSize: 12,
    color: colors.white + 'DD',
    fontWeight: '600',
  },
});
