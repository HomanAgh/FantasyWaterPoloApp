import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import { searchAndFilterPlayersWithStats } from '../services/playerService';
import { fetchTeams } from '../services/teamService';
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
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [teams, setTeams] = useState([]);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Price filter: null = no max limit
  const [maxPrice, setMaxPrice] = useState(null);
  const [showPricePicker, setShowPricePicker] = useState(false);
  const [affordableOnly, setAffordableOnly] = useState(false);

  // FPL-style: which stat is currently selected (controls sort + row display)
  const [statView, setStatView] = useState('pts');

  const positions = ['All', 'Goalkeeper', 'Field Player'];

  // "Francesco Di Fulvio" → "F. Di Fulvio"
  const abbreviateName = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length <= 1) return name;
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
  };

  // Price steps from 1M to 20M in 0.5M increments
  const priceSteps = [];
  for (let p = 10; p <= 200; p += 5) {
    priceSteps.push(p / 10);
  }

  // Stat columns for the table — key matches statView state values
  const STAT_COLS = [
    { key: 'pts',   label: 'Pts',  field: 'points' },
    { key: 'price', label: '£',    field: 'price' },
    { key: 'goals', label: 'Gls',  field: 'goals' },
    { key: 'ass',   label: 'Ass',  field: 'assists' },
    { key: 'saves', label: 'Svs',  field: 'saves' },
    { key: 'blc',   label: 'Blc',  field: 'blocks' },
    { key: 'spr',   label: 'Spr',  field: 'sprints' },
    { key: 'cs',    label: 'CS',   field: 'cleanSheets' },
    { key: 'app',   label: 'App',  field: 'gamesPlayed' },
  ];

  // Fixed dimensions for pixel-perfect column alignment
  const ROW_H       = 50;
  const HEADER_H    = 36;
  const NAME_COL_W  = 145;
  const ACTION_COL_W = 52;
  const STAT_COL_W  = 52;

  // Get team state from context
  const { 
    selectedPlayers, 
    addPlayer, 
    removePlayer,
    makeTransfer,
    remainingBudget,
    canAddPlayer,
    freeTransfers,
    pendingDeductions,
    isUnlimitedPhase,
  } = useTeam();

  // Get round info from context
  const { currentRound, isLocked } = useRound();

  // When replacing a player, the budget freed by the outgoing player is available
  const effectiveBudget = (mode === 'replace' && replacingPlayer)
    ? remainingBudget + replacingPlayer.price
    : remainingBudget;

  // Load teams on mount
  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    const { data } = await fetchTeams();
    if (data) {
      setTeams([{ id: 'all', name: 'All Teams' }, ...data]);
    }
  };

  // Fetch players on mount and when filters change
  useEffect(() => {
    loadPlayers();
  }, [selectedPosition, selectedTeam]);

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

    const { data, error: fetchError } = await searchAndFilterPlayersWithStats(
      searchQuery,
      selectedPosition,
      selectedTeam
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

  const executeTransfer = async (player) => {
    const result = await makeTransfer(replacingPlayer, player);
    if (!result.success) {
      setErrorMessage(result.error || 'Failed to transfer player');
      setTimeout(() => setErrorMessage(''), 5000);
    } else {
      navigation.navigate('Transfers');
    }
  };

  const handleAddPlayer = async (player) => {
    setErrorMessage('');

    // Replace mode — use the transfer system
    if (mode === 'replace' && replacingPlayer) {
      // In the unlimited pre-GW1 phase, swap freely with no confirmation needed
      if (isUnlimitedPhase) {
        await executeTransfer(player);
        return;
      }

      // Post-GW1: warn the user if this will cost points
      if (freeTransfers === 0) {
        const totalAfter = pendingDeductions + 4;
        Alert.alert(
          '⚠️ Confirm Transfer (-4 pts)',
          `OUT  ${replacingPlayer.name}\n${replacingPlayer.team} • ${replacingPlayer.position} • $${replacingPlayer.price.toFixed(1)}M\n\nIN  ${player.name}\n${player.team} • ${player.position} • $${player.price.toFixed(1)}M\n\nNo free transfers remaining. This will cost -4 points.\nTotal point hit this GW: -${totalAfter} pts`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm (-4 pts)',
              style: 'destructive',
              onPress: () => executeTransfer(player),
            },
          ]
        );
        return;
      }

      // Has a free transfer — confirm before executing
      const transfersAfter = freeTransfers - 1;
      Alert.alert(
        '🔄 Confirm Transfer',
        `OUT  ${replacingPlayer.name}\n${replacingPlayer.team} • ${replacingPlayer.position} • $${replacingPlayer.price.toFixed(1)}M\n\nIN  ${player.name}\n${player.team} • ${player.position} • $${player.price.toFixed(1)}M\n\nUses 1 free transfer (${transfersAfter} remaining after).`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm Transfer', onPress: () => executeTransfer(player) },
        ]
      );
      return;
    }

    // Normal add (initial squad building / filling empty slots)
    const result = await addPlayer(player);
    if (!result.success) {
      setErrorMessage(result.error || 'Failed to add player');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    setErrorMessage('');
    await removePlayer(playerId);
  };

  // Apply client-side price filter + stat sort (no extra fetch needed)
  const displayPlayers = (() => {
    let result = [...players];

    if (maxPrice !== null) result = result.filter(p => p.price <= maxPrice);
    if (affordableOnly)    result = result.filter(p => p.price <= effectiveBudget);

    const col = STAT_COLS.find(c => c.key === statView);
    result.sort((a, b) => {
      if (statView === 'name') return a.name.localeCompare(b.name);
      const field = col?.field || 'points';
      return (b[field] || 0) - (a[field] || 0);
    });

    return result;
  })();

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
          <Text style={styles.budgetValue}>${effectiveBudget.toFixed(1)}M</Text>
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
        
        {/* Team Dropdown */}
        <TouchableOpacity
          style={styles.teamDropdown}
          onPress={() => setShowTeamPicker(true)}
          activeOpacity={0.7}>
          <Text style={styles.teamDropdownLabel}>🏊 Team:</Text>
          <Text style={styles.teamDropdownValue}>
            {teams.find(t => t.id === selectedTeam)?.name || 'All Teams'}
          </Text>
          <Text style={styles.teamDropdownIcon}>▼</Text>
        </TouchableOpacity>

        {/* Price Filter Row */}
        <View style={styles.priceRow}>
          <TouchableOpacity
            style={styles.priceDropdown}
            onPress={() => setShowPricePicker(true)}
            activeOpacity={0.7}>
            <Text style={styles.teamDropdownLabel}>💰 Max:</Text>
            <Text style={styles.teamDropdownValue}>
              {maxPrice !== null ? `$${maxPrice.toFixed(1)}M` : 'Any price'}
            </Text>
            <Text style={styles.teamDropdownIcon}>▼</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.affordableChip, affordableOnly && styles.affordableChipActive]}
            onPress={() => setAffordableOnly(v => !v)}
            activeOpacity={0.7}>
            <Text style={[styles.affordableChipText, affordableOnly && styles.affordableChipTextActive]}>
              {affordableOnly
                ? `≤$${effectiveBudget.toFixed(1)}M`
                : 'Affordable'}
            </Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* Team Picker Modal */}
      <Modal
        transparent={true}
        visible={showTeamPicker}
        animationType="slide"
        onRequestClose={() => setShowTeamPicker(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTeamPicker(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Team</Text>
              <TouchableOpacity onPress={() => setShowTeamPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {teams.map((team) => (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.modalItem,
                    selectedTeam === team.id && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setSelectedTeam(team.id);
                    setShowTeamPicker(false);
                  }}>
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedTeam === team.id && styles.modalItemTextActive,
                    ]}>
                    {team.name}
                  </Text>
                  {selectedTeam === team.id && (
                    <Text style={styles.modalItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Price Picker Modal */}
      <Modal
        transparent={true}
        visible={showPricePicker}
        animationType="slide"
        onRequestClose={() => setShowPricePicker(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPricePicker(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Max Player Price</Text>
              <TouchableOpacity onPress={() => setShowPricePicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={[styles.modalItem, maxPrice === null && styles.modalItemActive]}
                onPress={() => { setMaxPrice(null); setShowPricePicker(false); }}>
                <Text style={[styles.modalItemText, maxPrice === null && styles.modalItemTextActive]}>
                  Any price
                </Text>
                {maxPrice === null && <Text style={styles.modalItemCheck}>✓</Text>}
              </TouchableOpacity>
              {priceSteps.map((step) => (
                <TouchableOpacity
                  key={step}
                  style={[styles.modalItem, maxPrice === step && styles.modalItemActive]}
                  onPress={() => { setMaxPrice(step); setShowPricePicker(false); }}>
                  <Text style={[styles.modalItemText, maxPrice === step && styles.modalItemTextActive]}>
                    Up to ${step.toFixed(1)}M
                  </Text>
                  {maxPrice === step && <Text style={styles.modalItemCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

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
        ) : displayPlayers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No players found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || selectedPosition !== 'All' || selectedTeam !== 'all' || maxPrice !== null || affordableOnly
                ? 'Try adjusting your search or filters'
                : 'Start by adding player data to your database'}
            </Text>
          </View>
        ) : (
          /* ── FPL-style sticky-column stats table ── */
          <View style={styles.tableOuter}>
            <View style={{ flexDirection: 'row' }}>

              {/* ── Column 1: Fixed player name ── */}
              <View style={{ width: NAME_COL_W }}>
                {/* Name column header – tap for A→Z sort */}
                <TouchableOpacity
                  style={[styles.th, styles.thName, statView === 'name' && styles.thActive]}
                  onPress={() => setStatView('name')}
                  activeOpacity={0.7}>
                  <Text style={[styles.thText, statView === 'name' && styles.thTextActive]}>
                    Player {statView === 'name' ? '↑' : ''}
                  </Text>
                </TouchableOpacity>

                {displayPlayers.map((player, idx) => (
                  <TouchableOpacity
                    key={player.id}
                    style={[
                      styles.tdName,
                      { height: ROW_H },
                      idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                      selectedPlayers.some(p => p.id === player.id) && styles.rowInTeam,
                    ]}
                    onPress={() => navigation.navigate('PlayerDetail', { playerId: player.id, player })}
                    activeOpacity={0.7}>
                    <View style={[
                      styles.pcPosBadge,
                      player.position === 'GK' ? styles.pcPosBadgeGK : styles.pcPosBadgeFP,
                    ]}>
                      <Text style={styles.pcPosText}>
                        {player.position === 'GK' ? 'GK' : 'FP'}
                      </Text>
                    </View>
                    <View style={styles.pcNameBlock}>
                      <Text style={styles.pcName} numberOfLines={1}>{abbreviateName(player.name)}</Text>
                      <Text style={styles.pcTeam} numberOfLines={1}>{player.team}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Column 2: Horizontally scrollable stats ──
                   Header + all data rows share ONE ScrollView so they
                   scroll in perfect sync — no ref syncing needed. ── */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                nestedScrollEnabled={true}
                style={{ flex: 1 }}>
                <View>
                  {/* Stat column headers */}
                  <View style={{ flexDirection: 'row' }}>
                    {STAT_COLS.map(col => (
                      <TouchableOpacity
                        key={col.key}
                        style={[styles.th, { width: STAT_COL_W }, statView === col.key && styles.thActive]}
                        onPress={() => setStatView(col.key)}
                        activeOpacity={0.7}>
                        <Text style={[styles.thText, statView === col.key && styles.thTextActive]}>
                          {col.label}
                        </Text>
                        {statView === col.key && (
                          <Text style={styles.thArrow}>↓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Data rows */}
                  {displayPlayers.map((player, idx) => (
                    <View
                      key={player.id}
                      style={[
                        { flexDirection: 'row', height: ROW_H },
                        idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                        selectedPlayers.some(p => p.id === player.id) && styles.rowInTeam,
                      ]}>
                      {STAT_COLS.map(col => (
                        <View
                          key={col.key}
                          style={[
                            styles.td,
                            { width: STAT_COL_W },
                            statView === col.key && styles.tdActive,
                          ]}>
                          <Text style={[styles.tdText, statView === col.key && styles.tdTextActive]}>
                            {col.key === 'price'
                              ? `$${player.price.toFixed(1)}`
                              : player[col.field]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* ── Column 3: Fixed action buttons ── */}
              <View style={{ width: ACTION_COL_W }}>
                {/* Empty header cell to align with stat headers */}
                <View style={[styles.th, { width: ACTION_COL_W }]} />

                {displayPlayers.map((player, idx) => {
                  const isInTeam = selectedPlayers.some(p => p.id === player.id);
                  const canAdd = (mode === 'replace' && replacingPlayer)
                    ? { canAdd: !isInTeam && effectiveBudget >= player.price }
                    : canAddPlayer(player);

                  return (
                    <View
                      key={player.id}
                      style={[
                        styles.tdAction,
                        { height: ROW_H },
                        idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                        isInTeam && styles.rowInTeam,
                      ]}>
                      {isInTeam ? (
                        <TouchableOpacity
                          style={[styles.pcBtnIn, isLocked && styles.pcBtnDisabled]}
                          onPress={() => handleRemovePlayer(player.id)}
                          disabled={isLocked}
                          activeOpacity={0.7}>
                          <Text style={[styles.pcBtnInText, isLocked && styles.pcBtnDisabledText]}>✓</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.pcBtnAdd, (!canAdd || isLocked) && styles.pcBtnDisabled]}
                          onPress={() => handleAddPlayer(player)}
                          disabled={!canAdd || isLocked}
                          activeOpacity={0.7}>
                          <Text style={[styles.pcBtnAddText, (!canAdd || isLocked) && styles.pcBtnDisabledText]}>
                            {isLocked ? '🔒' : mode === 'replace' ? '⇄' : '+'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>

            </View>
          </View>
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
    padding: 0,
  },
  // ── Table layout ──
  tableOuter: {
    backgroundColor: colors.white,
    ...shadows.small,
  },
  // Header cell base
  th: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.oceanDeep,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 4,
  },
  thName: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
  },
  thActive: {
    backgroundColor: colors.teal,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
  },
  thTextActive: {
    color: colors.white,
  },
  thArrow: {
    fontSize: 9,
    color: colors.white,
    marginTop: 1,
  },
  // Name column data cell
  tdName: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '15',
    gap: spacing.sm,
  },
  // Stat data cell
  td: {
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '15',
    borderRightWidth: 1,
    borderRightColor: colors.oceanBright + '10',
  },
  tdActive: {
    backgroundColor: colors.oceanDeep + '10',
  },
  tdText: {
    fontSize: 13,
    color: colors.textMedium,
    fontWeight: '500',
  },
  tdTextActive: {
    color: colors.oceanDeep,
    fontWeight: '700',
  },
  // Action cell (+ / ✓ button column)
  tdAction: {
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '15',
  },
  // Row stripe / state
  rowEven: {
    backgroundColor: colors.white,
  },
  rowOdd: {
    backgroundColor: colors.backgroundLight,
  },
  rowInTeam: {
    backgroundColor: colors.teal + '12',
  },
  // Position badge (shared with table)
  pcPosBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pcPosBadgeGK: {
    backgroundColor: colors.teal,
  },
  pcPosBadgeFP: {
    backgroundColor: colors.oceanMedium,
  },
  pcPosText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pcNameBlock: {
    flex: 1,
    minWidth: 0,
  },
  pcName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  pcTeam: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  pcBtnAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.oceanMedium,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  pcBtnAddText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  pcBtnIn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pcBtnInText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  pcBtnDisabled: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.textMuted + '40',
  },
  pcBtnDisabledText: {
    color: colors.textMuted,
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
  teamDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.oceanBright + '40',
    ...shadows.small,
  },
  teamDropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginRight: spacing.sm,
  },
  teamDropdownValue: {
    flex: 1,
    fontSize: 14,
    color: colors.oceanDeep,
    fontWeight: '500',
  },
  teamDropdownIcon: {
    fontSize: 12,
    color: colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  priceDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.oceanBright + '40',
    ...shadows.small,
  },
  affordableChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.oceanBright + '40',
  },
  affordableChipActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  affordableChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMedium,
  },
  affordableChipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    ...shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '20',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  modalClose: {
    fontSize: 24,
    color: colors.textMuted,
    fontWeight: '300',
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.oceanBright + '10',
  },
  modalItemActive: {
    backgroundColor: colors.oceanBright + '10',
  },
  modalItemText: {
    fontSize: 16,
    color: colors.textDark,
  },
  modalItemTextActive: {
    fontWeight: '600',
    color: colors.oceanDeep,
  },
  modalItemCheck: {
    fontSize: 20,
    color: colors.success,
  },
});
