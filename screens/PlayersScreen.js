import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Icons } from '../assets/images/icons';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';
import { searchAndFilterPlayersWithStats } from '../services/playerService';
import { fetchTeams } from '../services/teamService';
import { useTeam } from '../context/TeamContext';
import { useRound } from '../context/RoundContext';
import * as playerRoundPointsService from '../services/playerRoundPointsService';
import {
  getReplaceSession,
  clearReplaceSession,
} from '../utils/transferReplaceSession';

export default function PlayersScreen({ navigation, route }) {
  // Mirrored from module store so UI updates; store survives PlayerDetail remounts.
  const [replaceSession, setReplaceSession] = useState(() => getReplaceSession());
  // Set right before opening PlayerDetail so blur cleanup does not end replace mode.
  const keepReplaceForDetailRef = useRef(false);

  const endReplaceSession = useCallback(() => {
    clearReplaceSession();
    setReplaceSession(null);
  }, []);

  const replacingPlayer = replaceSession?.replacingPlayer ?? null;
  const filterPosition = replaceSession?.filterPosition ?? route?.params?.filterPosition;
  const mode = replaceSession ? 'replace' : 'add';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('All');
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
  // true = low→high / A→Z; false = high→low / Z→A (stats default high→low)
  const [sortAsc, setSortAsc] = useState(false);

  const handleSortPress = (key) => {
    if (statView === key) {
      setSortAsc((prev) => !prev);
      return;
    }
    setStatView(key);
    // Name defaults A→Z; numeric stats default high→low
    setSortAsc(key === 'name');
  };

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
    { key: 'pts',   label: 'PTS',  field: 'points' },
    { key: 'price', label: '$',    field: 'price' },
    { key: 'goals', label: 'GLS',  field: 'goals' },
    { key: 'ass',   label: 'ASS',  field: 'assists' },
    { key: 'saves', label: 'SVS',  field: 'saves' },
    { key: 'blc',   label: 'BLC',  field: 'blocks' },
    { key: 'spr',   label: 'SPR',  field: 'sprints' },
    { key: 'pfd', label: 'PFD', field: 'foulsDrawn' },
    { key: 'stl',   label: 'STL',  field: 'steals' },
    { key: 'cs',    label: 'CS',   field: 'cleanSheets' },
    { key: 'app',   label: 'APP',  field: 'gamesPlayed' },
  ];

  // Fixed dimensions for pixel-perfect column alignment
  const ROW_H       = 50;
  const HEADER_H    = 36;
  const NAME_COL_W  = 145;
  const ACTION_COL_W = 52;
  const STAT_COL_W  = 50;

  // Get team state from context
  const { 
    selectedPlayers, 
    addPlayer, 
    removePlayer,
    makeTransfer,
    remainingBudget,
    canAddPlayer,
    freeTransfers,
    unlockedFreeTransfers,
    unlockFreeTransferFromAd,
    pendingDeductions,
    isUnlimitedPhase,
    squadFinalized,
    MAX_PLAYERS,
  } = useTeam();

  // Get round info from context
  const { currentRound, isLocked } = useRound();

  // When replacing a player, the budget freed by the outgoing player is available
  const effectiveBudget = (mode === 'replace' && replacingPlayer)
    ? remainingBudget + replacingPlayer.price
    : remainingBudget;

  // Same idea for squad size: outgoing player is treated as already out
  const effectiveSquadCount = (mode === 'replace' && replacingPlayer)
    ? Math.max(0, selectedPlayers.length - 1)
    : selectedPlayers.length;

  // Post-GW1, a full squad cannot use addPlayer / removePlayer directly —
  // all changes must go through the Transfers → replace flow.
  const isSquadFull = selectedPlayers.length >= MAX_PLAYERS;

  useFocusEffect(
    useCallback(() => {
      // Restore from module store after PlayerDetail / remount
      const existing = getReplaceSession();
      if (existing) {
        setReplaceSession(existing);
        if (existing.filterPosition === 'GK') setSelectedPosition('Goalkeeper');
        else if (existing.filterPosition === 'Outfield') setSelectedPosition('Field Player');
      } else {
        const params = route.params || {};
        if (params.filterPosition && params.mode !== 'replace') {
          if (params.filterPosition === 'GK') setSelectedPosition('Goalkeeper');
          else if (params.filterPosition === 'Outfield') setSelectedPosition('Field Player');
          navigation.setParams({ filterPosition: null });
        }
      }

      // Leaving Players ends replace — unless we opened PlayerDetail on purpose.
      return () => {
        if (keepReplaceForDetailRef.current) {
          keepReplaceForDetailRef.current = false;
          return;
        }
        clearReplaceSession();
        setReplaceSession(null);
      };
    }, [navigation, route.params?.filterPosition, route.params?.mode])
  );

  // Tapping the Players tab again cancels an in-progress replace.
  useEffect(() => {
    const unsubTabPress = navigation.addListener('tabPress', () => {
      endReplaceSession();
    });
    return unsubTabPress;
  }, [navigation, endReplaceSession]);

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
      endReplaceSession();
      navigation.navigate('Transfers');
    }
  };

  const buildTransferSummary = (player) =>
    `OUT  ${replacingPlayer.name}\n${replacingPlayer.team} • ${replacingPlayer.position} • $${replacingPlayer.price.toFixed(1)}M\n\nIN  ${player.name}\n${player.team} • ${player.position} • $${player.price.toFixed(1)}M`;

  const confirmPaidTransfer = (player) => {
    const totalAfter = pendingDeductions + 4;
    Alert.alert(
      '⚠️ Confirm Transfer (-4 pts)',
      `${buildTransferSummary(player)}\n\nNo unlocked free transfers. This will cost -4 points.\nTotal point hit this GW: -${totalAfter} pts`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm (-4 pts)',
          style: 'destructive',
          onPress: () => executeTransfer(player),
        },
      ]
    );
  };

  const confirmFreeTransfer = (player, transferState) => {
    const bankedNow = transferState?.freeTransfers ?? freeTransfers;
    const unlockedNow = transferState?.unlockedFreeTransfers ?? unlockedFreeTransfers;
    const bankedAfter = bankedNow - 1;
    const unlockedAfter = unlockedNow - 1;
    Alert.alert(
      '🔄 Confirm Transfer',
      `${buildTransferSummary(player)}\n\nUses 1 unlocked free transfer (${unlockedAfter} unlocked left, ${bankedAfter} banked after).`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Transfer', onPress: () => executeTransfer(player) },
      ]
    );
  };

  const promptUnlockOrPaidTransfer = (player) => {
    Alert.alert(
      '🔒 Free Transfer Locked',
      `${buildTransferSummary(player)}\n\nYou have ${freeTransfers} free transfer(s) banked but none unlocked.\n\nWatch a short ad to unlock one, or pay -4 pts for this swap.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Watch Ad to Unlock',
          onPress: async () => {
            const unlock = await unlockFreeTransferFromAd();
            if (unlock.success) {
              confirmFreeTransfer(player, {
                freeTransfers: unlock.freeTransfers,
                unlockedFreeTransfers: unlock.unlockedFreeTransfers,
              });
            }
          },
        },
        {
          text: 'Pay -4 pts',
          style: 'destructive',
          onPress: () => confirmPaidTransfer(player),
        },
      ]
    );
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

      if (unlockedFreeTransfers > 0) {
        confirmFreeTransfer(player);
        return;
      }

      if (freeTransfers > 0) {
        promptUnlockOrPaidTransfer(player);
        return;
      }

      confirmPaidTransfer(player);
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
    const dir = sortAsc ? 1 : -1;
    result.sort((a, b) => {
      if (statView === 'name') {
        return dir * a.name.localeCompare(b.name);
      }
      const field = col?.field || 'points';
      return dir * ((a[field] || 0) - (b[field] || 0));
    });

    return result;
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {mode === 'replace' && replacingPlayer ? 'SELECT REPLACEMENT' : 'PLAYERS'}
        </Text>
        {mode === 'replace' && replacingPlayer && (
          <View style={styles.replacementBanner}>
            <Text style={styles.replacementText}>
              REPLACING: {replacingPlayer.name.toUpperCase()}
            </Text>
            <Text style={styles.replacementSubtext}>
              ({replacingPlayer.position}) • ${replacingPlayer.price.toFixed(1)}M
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>TEAM</Text>
            <Text style={styles.statValue}>{effectiveSquadCount}/{MAX_PLAYERS}</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>BUDGET</Text>
            <Text style={styles.statValue}>${effectiveBudget.toFixed(1)}M</Text>
          </View>
        </View>
      </View>

      {/* Locked Banner */}
      {isLocked && currentRound && (
        <View style={styles.lockedBanner}>
          <Image source={Icons.locked} style={styles.lockedIcon} />
          <Text style={styles.lockedText}>
            Transfers locked — Gameweek {currentRound.round_number} in progress
          </Text>
        </View>
      )}

      {/* Error Message */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Image source={Icons.warning} style={styles.errorBannerIcon} />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Search and Filter */}
      <View style={styles.filterContainer}>
        <View style={styles.searchWrapper}>
          <Image source={Icons.magglass} style={[styles.searchIcon, styles.iconNeon]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search players...."
            placeholderTextColor={colors.auth.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.positionFilter}
        >
          {positions.map((pos) => (
            <TouchableOpacity
              key={pos}
              style={[
                styles.filterChip,
                selectedPosition === pos && styles.filterChipActive,
              ]}
              onPress={() => setSelectedPosition(pos)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedPosition === pos && styles.filterChipTextActive,
                ]}
              >
                {pos === 'All' ? 'ALL' : pos === 'Goalkeeper' ? 'GOALKEEPER' : 'FIELD PLAYER'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Team Dropdown */}
        <TouchableOpacity
          style={styles.teamDropdown}
          onPress={() => setShowTeamPicker(true)}
          activeOpacity={0.7}
        >
          <View style={styles.teamDropdownLabelRow}>
            <Image source={Icons.swimmer} style={[styles.teamDropdownLabelIcon, styles.iconNeon]} />
            <Text style={styles.teamDropdownLabel}>Team:</Text>
          </View>
          <Text style={styles.teamDropdownValue} numberOfLines={1}>
            {teams.find(t => t.id === selectedTeam)?.name || 'All teams'}
          </Text>
          <View style={styles.dropdownCaret}>
            <Text style={styles.teamDropdownIcon}>▼</Text>
          </View>
        </TouchableOpacity>

        {/* Price Filter Row */}
        <View style={styles.priceRow}>
          <TouchableOpacity
            style={styles.priceDropdown}
            onPress={() => setShowPricePicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.teamDropdownLabelRow}>
              <Image source={Icons.dollarsign} style={[styles.teamDropdownLabelIcon, styles.iconNeon]} />
              <Text style={styles.teamDropdownLabel}>Max:</Text>
            </View>
            <Text style={styles.teamDropdownValue} numberOfLines={1}>
              {maxPrice !== null ? `$${maxPrice.toFixed(1)}M` : 'Any price'}
            </Text>
            <View style={styles.dropdownCaret}>
              <Text style={styles.teamDropdownIcon}>▼</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.affordableChip, affordableOnly && styles.affordableChipActive]}
            onPress={() => setAffordableOnly(v => !v)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.affordableChipText,
                affordableOnly && styles.affordableChipTextActive,
              ]}
            >
              {affordableOnly ? `≤$${effectiveBudget.toFixed(1)}M` : 'Affordable'}
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
            <ActivityIndicator size="large" color={colors.auth.neon} />
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
                {/* Name column header – tap to sort A↔Z */}
                <TouchableOpacity
                  style={[styles.th, styles.thName, statView === 'name' && styles.thActive]}
                  onPress={() => handleSortPress('name')}
                  activeOpacity={0.7}>
                  <Text style={[styles.thText, statView === 'name' && styles.thTextActive]}>
                    PLAYER {statView === 'name' ? (sortAsc ? '↑' : '↓') : ''}
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
                    onPress={() => {
                      keepReplaceForDetailRef.current = true;
                      navigation.navigate('PlayerDetail', { playerId: player.id, player });
                    }}
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
                        onPress={() => handleSortPress(col.key)}
                        activeOpacity={0.7}>
                        <Text style={[styles.thText, statView === col.key && styles.thTextActive]}>
                          {col.label}
                        </Text>
                        {statView === col.key && (
                          <Text style={styles.thArrow}>{sortAsc ? '↑' : '↓'}</Text>
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
                              ? `$ ${player.price.toFixed(1)}M`
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

                  // Post-finalization, a full-squad add must go through Transfers.
                  // This prevents the free remove→add bypass of transfer cost rules.
                  const redirectToTransfers = squadFinalized && isSquadFull && mode !== 'replace';

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
                          style={[styles.pcBtnIn, (isLocked || squadFinalized) && styles.pcBtnDisabled]}
                          onPress={() => {
                            if (squadFinalized) {
                              Alert.alert(
                                'Use the Transfers Screen',
                                'To swap this player out, go to the Transfers screen and tap them on the pitch to pick a replacement.'
                              );
                              return;
                            }
                            handleRemovePlayer(player.id);
                          }}
                          disabled={isLocked}
                          activeOpacity={0.7}>
                          {isLocked
                            ? <Image source={Icons.locked} style={styles.pcBtnLockIcon} />
                            : <Text style={[styles.pcBtnInText, squadFinalized && styles.pcBtnDisabledText]}>
                                {squadFinalized ? '⇄' : '✓'}
                              </Text>
                          }
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.pcBtnAdd, (!canAdd || isLocked) && styles.pcBtnDisabled]}
                          onPress={() => {
                            if (redirectToTransfers) {
                              navigation.navigate('Transfers');
                              return;
                            }
                            handleAddPlayer(player);
                          }}
                          disabled={!canAdd || isLocked}
                          activeOpacity={0.7}>
                          {isLocked
                            ? <Image source={Icons.locked} style={styles.pcBtnLockIcon} />
                            : (redirectToTransfers || mode === 'replace')
                              ? <Text style={[styles.pcBtnAddText, !canAdd && styles.pcBtnDisabledText]}>⇄</Text>
                              : (
                                <Image
                                  source={Icons.plus}
                                  style={[styles.pcBtnPlusIcon, !canAdd && styles.pcBtnPlusIconDisabled]}
                                />
                              )
                          }
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
    backgroundColor: 'transparent',
  },
  content: {
    paddingBottom: spacing.xl,
  },

  header: {
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 64,
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.xxl + 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  statBadge: {
    flex: 1,
    backgroundColor: colors.auth.glass,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md + 4,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    alignItems: 'center',
    minHeight: 72,
    justifyContent: 'center',
  },
  statLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    marginBottom: -2,
  },
  statValue: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 28,
    color: colors.auth.statValue,
  },

  lockedBanner: {
    backgroundColor: colors.coral + '22',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  lockedIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  lockedText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.coral,
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  errorBanner: {
    backgroundColor: colors.auth.inputBg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBannerIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    marginRight: spacing.xs,
  },
  errorBannerText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 14,
    color: colors.coral,
    textAlign: 'center',
    flexShrink: 1,
  },

  filterContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.auth.inputBg,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  searchIcon: {
    width: 18,
    height: 18,
    marginRight: spacing.sm,
    resizeMode: 'contain',
  },
  iconNeon: {
    tintColor: colors.auth.neon,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.white,
  },
  positionFilter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.round,
    backgroundColor: colors.auth.inputBg,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  filterChipActive: {
    backgroundColor: colors.auth.glass,
    borderColor: colors.auth.neon,
    shadowColor: colors.auth.neon,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  filterChipText: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 24,
    color: colors.white,
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: colors.white,
  },

  teamDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.auth.inputBg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  teamDropdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamDropdownLabelIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  teamDropdownLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.white,
    marginRight: spacing.xs,
  },
  teamDropdownValue: {
    flex: 1,
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.white,
  },
  dropdownCaret: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamDropdownIcon: {
    fontSize: 9,
    color: colors.auth.neon,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.auth.inputBg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  affordableChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.auth.inputBg,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  affordableChipActive: {
    backgroundColor: colors.sand,
    borderColor: colors.sand,
  },
  affordableChipText: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.white,
  },
  affordableChipTextActive: {
    color: colors.oceanDeep,
  },

  replacementBanner: {
    backgroundColor: colors.auth.inputBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    alignItems: 'center',
    width: '100%',
  },
  replacementText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.white,
    marginBottom: 2,
  },
  replacementSubtext: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.auth.placeholder,
  },

  playersList: {
    paddingHorizontal: spacing.md,
  },
  tableOuter: {},
  th: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderTopColor: colors.auth.neon,
    borderBottomColor: colors.auth.neon,
    paddingHorizontal: 4,
  },
  thName: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
  },
  thActive: {
    backgroundColor: 'transparent',
  },
  thText: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 13,
    color: colors.auth.statLabel,
    letterSpacing: 0.5,
  },
  thTextActive: {
    color: colors.sand,
  },
  thArrow: {
    fontSize: 9,
    color: colors.sand,
    marginTop: 1,
  },
  tdName: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.auth.neon,
    gap: spacing.sm,
  },
  td: {
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.auth.neon,
  },
  tdActive: {
    backgroundColor: 'transparent',
  },
  tdText: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 18,
    color: colors.white,
  },
  tdTextActive: {
    color: colors.sand,
    fontFamily: fonts.barlowCondensedMedium,
  },
  tdAction: {
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.auth.neon,
  },
  rowEven: {
    backgroundColor: 'transparent',
  },
  rowOdd: {
    backgroundColor: 'transparent',
  },
  rowInTeam: {
    backgroundColor: 'transparent',
  },
  pcPosBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    backgroundColor: colors.auth.inputBg,
  },
  pcPosBadgeGK: {},
  pcPosBadgeFP: {},
  pcPosText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    color: colors.white,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  pcNameBlock: {
    flex: 1,
    minWidth: 0,
  },
  pcName: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 18,
    color: colors.white,
  },
  pcTeam: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 11,
    color: colors.auth.statLabel,
    marginTop: 1,
  },
  pcBtnAdd: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.auth.buttonTop,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.auth.buttonBottom,
  },
  pcBtnAddText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    color: colors.white,
    fontSize: 20,
    lineHeight: 22,
  },
  pcBtnPlusIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: colors.white,
  },
  pcBtnPlusIconDisabled: {
    tintColor: colors.auth.placeholder,
  },
  pcBtnIn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.auth.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  pcBtnInText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    color: colors.auth.neon,
    fontSize: 16,
  },
  pcBtnDisabled: {
    backgroundColor: colors.auth.inputBg,
    borderWidth: 0.5,
    borderColor: colors.auth.neonSoft,
  },
  pcBtnDisabledText: {
    color: colors.auth.placeholder,
  },
  pcBtnLockIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: colors.auth.placeholder,
  },

  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 18,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 14,
    color: colors.auth.placeholder,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.auth.placeholder,
    marginTop: spacing.md,
  },
  errorContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.auth.placeholder,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.auth.buttonTop,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  retryButtonText: {
    fontFamily: fonts.barlowCondensedBold,
    color: colors.white,
    fontSize: 16,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 11, 24, 0.72)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A1A2E',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    borderBottomWidth: 0,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.auth.neonSoft,
  },
  modalTitle: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 18,
    color: colors.white,
    letterSpacing: 0.5,
  },
  modalClose: {
    fontSize: 24,
    color: colors.auth.placeholder,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.auth.neonSoft,
  },
  modalItemActive: {
    backgroundColor: 'rgba(0, 174, 239, 0.12)',
  },
  modalItemText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.white,
  },
  modalItemTextActive: {
    fontFamily: fonts.barlowCondensedBold,
    color: colors.auth.neon,
  },
  modalItemCheck: {
    fontSize: 20,
    color: colors.auth.neon,
  },
});
