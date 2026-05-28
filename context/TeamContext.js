import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import supabase from '../config/supabaseClient';
import { useAuth } from './AuthContext';
import * as userTeamService from '../services/userTeamService';
import * as playerRoundPointsService from '../services/playerRoundPointsService';
import * as userProfileService from '../services/userProfileService';
import * as transferService from '../services/transferService';
import * as userGwPicksService from '../services/userGwPicksService';
import { getUserGlobalRank } from '../services/leagueService';
import { useRound } from './RoundContext';

// Constants
const STARTING_BUDGET = 100.0; // $100M
const MAX_PLAYERS = 12;
const MAX_GOALKEEPERS = 2;
const MAX_OUTFIELD = 10;
const MAX_STARTERS = 7;
const MAX_GK_STARTERS = 1;
const MAX_OUTFIELD_STARTERS = 6;
const MAX_SUBSTITUTES = 5;
const MAX_GK_SUBSTITUTES = 1;
const MAX_OUTFIELD_SUBSTITUTES = 4;

// Create context
const TeamContext = createContext();

/**
 * Hook to use the Team context
 */
export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};

/**
 * Team Provider Component
 */
export const TeamProvider = ({ children }) => {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [captainId, setCaptainId] = useState(null);
  const [teamName, setTeamName] = useState('My Team');

  // Transfer state
  const [freeTransfers, setFreeTransfers] = useState(1);
  const [lastTransferRoundId, setLastTransferRoundId] = useState(null);
  const [transfersMadeThisRound, setTransfersMadeThisRound] = useState(0);
  const [squadFinalized, setSquadFinalized] = useState(false);
  const [pendingDeductions, setPendingDeductions] = useState(0);

  // Accumulated locked points — sum of all past GW scores from snapshots
  const [lockedTotalPoints, setLockedTotalPoints] = useState(0);

  // Round context — TeamProvider is always rendered inside RoundProvider
  const { currentRound, isLocked } = useRound();

  // Auth context — userId comes from Supabase Auth session
  const { userId: authUserId } = useAuth();

  // Re-initialize team whenever the logged-in user changes (login / logout)
  useEffect(() => {
    if (authUserId) {
      initializeTeam(authUserId);
    } else {
      // User signed out — clear all team state
      setUserId(null);
      setSelectedPlayers([]);
      setCaptainId(null);
      setTeamName('My Team');
      setFreeTransfers(1);
      setLastTransferRoundId(null);
      setTransfersMadeThisRound(0);
      setSquadFinalized(false);
      setPendingDeductions(0);
      setLockedTotalPoints(0);
      setIsLoading(false);
    }
  }, [authUserId]);

  /**
   * Initialize team data for the given authenticated user
   */
  const initializeTeam = async (id) => {
    try {
      setIsLoading(true);
      setUserId(id);
      await loadUserTeam(id);
      await loadTransferState(id);
      await loadLockedTotalPoints(id);
    } catch (error) {
      console.error('Error initializing team:', error);
      Alert.alert('Error', 'Failed to initialize team. Please restart the app.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load transfer state from Supabase into local state
   */
  const loadTransferState = async (userIdParam = userId) => {
    if (!userIdParam) return;
    try {
      const { data, error } = await transferService.getTransferState(userIdParam);
      if (error || !data) return;
      setFreeTransfers(data.freeTransfers);
      setLastTransferRoundId(data.lastTransferRoundId);
      setTransfersMadeThisRound(data.transfersMadeThisRound);
      setSquadFinalized(data.squadFinalized);
      setPendingDeductions(data.pendingDeductions);
    } catch (error) {
      console.error('Error loading transfer state:', error);
    }
  };

  /**
   * Refresh the accumulated locked total points from all GW snapshots
   */
  const loadLockedTotalPoints = async (userIdParam = userId) => {
    if (!userIdParam) return;
    try {
      // Use the DB-authoritative rank/points rather than re-deriving from
      // user_gw_picks snapshots, which may not exist if the app was closed
      // when past gameweeks locked.
      const { totalPoints, error } = await getUserGlobalRank(userIdParam);
      if (!error) {
        setLockedTotalPoints(totalPoints ?? 0);
      }
    } catch (error) {
      console.error('Error loading locked total points:', error);
    }
  };

  /**
   * Load user's team from Supabase
   */
  const loadUserTeam = async (userIdParam = userId) => {
    if (!userIdParam) return;

    try {
      setIsLoading(true);
      const { data, error } = await userTeamService.getUserTeam(userIdParam);

      if (error) {
        console.error('Error loading user team:', error);
        Alert.alert('Error', 'Failed to load your team.');
        return;
      }

      setSelectedPlayers(data || []);
      
      // Extract and set captain
      const captain = data?.find(p => p.isCaptain);
      
      // Auto-assign captain if none exists but we have starters
      if (!captain && data && data.length > 0) {
        const starters = data.filter(p => p.isStarter);
        if (starters.length > 0) {
          const firstStarter = starters[0];
          // Set captain in database
          await userTeamService.updateCaptain(userIdParam, firstStarter.id);
          // Update local state
          setCaptainId(firstStarter.id);
          setSelectedPlayers(prev => prev.map(p => ({
            ...p,
            isCaptain: p.id === firstStarter.id
          })));
        } else {
          setCaptainId(null);
        }
      } else {
        setCaptainId(captain?.id || null);
      }
    } catch (error) {
      console.error('Error in loadUserTeam:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load user's team name from profile
   */
  const loadTeamName = async (userIdParam = userId) => {
    if (!userIdParam) return;

    try {
      const { data, error } = await userProfileService.getUserProfile(userIdParam);
      
      if (error) {
        console.error('Error loading team name:', error);
        return;
      }

      if (data) {
        setTeamName(data.team_name);
      }
    } catch (error) {
      console.error('Error in loadTeamName:', error);
    }
  };

  /**
   * Update user's team name
   * @param {string} newTeamName - New team name
   */
  const updateTeamNameInContext = async (newTeamName) => {
    if (!userId) return { success: false, error: 'User not initialized' };

    try {
      const { data, error } = await userProfileService.updateTeamName(userId, newTeamName);

      if (error) {
        Alert.alert('Error', 'Failed to update team name. Please try again.');
        return { success: false, error };
      }

      setTeamName(newTeamName);
      return { success: true, error: null };
    } catch (error) {
      console.error('Error updating team name:', error);
      Alert.alert('Error', 'Failed to update team name. Please try again.');
      return { success: false, error };
    }
  };

  // ===== Transfer Round Transition =====

  /**
   * Detect GW changes and handle:
   *  1. Squad finalization + GW1 snapshot when GW1 deadline passes
   *  2. Snapshot save when any subsequent GW locks
   *  3. Free-transfer rollover when a new GW starts
   */
  useEffect(() => {
    if (!userId || !currentRound) return;

    const handleRoundTransition = async () => {
      // Always read authoritative state from the DB — local state may not be
      // hydrated yet when this effect fires early (e.g. userId just set but
      // loadTransferState hasn't completed). Trusting local squadFinalized or
      // lastTransferRoundId here causes spurious finalizeSquad / rollover calls
      // on every app reload.
      const { data: freshState } = await transferService.getTransferState(userId);
      if (!freshState) return; // DB read failed or no profile yet

      const dbSquadFinalized = freshState.squadFinalized;
      const dbLastTransferRoundId = freshState.lastTransferRoundId ?? null;

      if (!dbSquadFinalized) {
        // GW1 deadline passed OR app opened past GW1 for the first time
        const shouldFinalize =
          (currentRound.round_number === 1 && isLocked) ||
          currentRound.round_number > 1;

        if (shouldFinalize) {
          // Guard: only finalize if the user has actually completed registration
          // (i.e. their user_profiles row exists). Without this check, the UPDATE
          // in finalizeSquad crashes with PGRST116 for users mid-registration.
          const { data: profileCheck } = await userProfileService.getUserProfile(userId);
          if (!profileCheck) {
            // Profile doesn't exist yet — user is still on the registration screen.
            return;
          }

          // Lock the GW1 squad into a snapshot (only when the deadline has actually passed)
          if (isLocked && selectedPlayers.length > 0) {
            await userGwPicksService.saveGwSnapshot(
              userId, currentRound.id, selectedPlayers, captainId
            );
          }

          const { error } = await transferService.finalizeSquad(userId, currentRound.id);
          if (!error) {
            setSquadFinalized(true);
            setLastTransferRoundId(currentRound.id);
            setFreeTransfers(1);
            setTransfersMadeThisRound(0);
            setPendingDeductions(0);
            await loadLockedTotalPoints(userId);
          }
        }
        return;
      }

      // Squad already finalized — save snapshot whenever the current round locks.
      // ignoreDuplicates ensures this is idempotent across app restarts.
      if (isLocked && selectedPlayers.length > 0) {
        await userGwPicksService.saveGwSnapshot(
          userId, currentRound.id, selectedPlayers, captainId
        );
        await loadLockedTotalPoints(userId);
      }

      // New GW started (deadline not yet passed) — award a free transfer.
      // Use the DB value read above (dbLastTransferRoundId) to avoid stale-closure issues.
      if (!isLocked && dbLastTransferRoundId !== null && currentRound.id !== dbLastTransferRoundId) {
        const result = await transferService.processRoundRollover(userId, currentRound.id);
        if (!result.error && result.data) {
          setFreeTransfers(result.data.free_transfers);
          setTransfersMadeThisRound(0);
          setPendingDeductions(0);
          setLastTransferRoundId(currentRound.id);
        }
      }
    };

    handleRoundTransition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentRound?.id, isLocked]);

  /**
   * Snapshot safety net — fires whenever selectedPlayers finishes loading.
   * The main handleRoundTransition effect above can run before loadUserTeam
   * completes, leaving selectedPlayers empty and skipping the save.
   * This effect re-attempts the save once players are actually in state.
   * saveGwSnapshot uses ignoreDuplicates:true so the first write always wins —
   * subsequent calls for the same (user, round, player) are silent no-ops.
   */
  useEffect(() => {
    if (!userId || !currentRound || !isLocked) return;
    if (selectedPlayers.length === 0) return;

    userGwPicksService.saveGwSnapshot(userId, currentRound.id, selectedPlayers, captainId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayers, isLocked, currentRound?.id, userId]);

  // ===== Derived Values =====

  /**
   * True while GW1 deadline hasn't passed — all squad changes are free.
   */
  const isUnlimitedPhase = !squadFinalized;

  /**
   * Calculate total spent on selected players
   */
  const totalSpent = selectedPlayers.reduce((sum, player) => sum + player.price, 0);

  /**
   * Calculate remaining budget
   */
  const remainingBudget = STARTING_BUDGET - totalSpent;

  /**
   * Count of starters
   */
  const startersCount = selectedPlayers.filter((p) => p.isStarter).length;

  /**
   * Count of substitutes
   */
  const substitutesCount = selectedPlayers.filter((p) => !p.isStarter).length;

  /**
   * Count of GK starters
   */
  const gkStartersCount = selectedPlayers.filter(
    (p) => p.position === 'GK' && p.isStarter
  ).length;

  /**
   * Count of Outfield starters
   */
  const outfieldStartersCount = selectedPlayers.filter(
    (p) => p.position === 'Outfield' && p.isStarter
  ).length;

  /**
   * Count of GK substitutes
   */
  const gkSubstitutesCount = selectedPlayers.filter(
    (p) => p.position === 'GK' && !p.isStarter
  ).length;

  /**
   * Count of Outfield substitutes
   */
  const outfieldSubstitutesCount = selectedPlayers.filter(
    (p) => p.position === 'Outfield' && !p.isStarter
  ).length;

  /**
   * Count of goalkeepers in team
   */
  const goalkeepersCount = selectedPlayers.filter((p) => p.position === 'GK').length;

  /**
   * Count of outfield players in team
   */
  const outfieldCount = selectedPlayers.filter((p) => p.position === 'Outfield').length;

  /**
   * Calculate total points for the team
   */
  const totalPoints = selectedPlayers.reduce((sum, player) => sum + player.points, 0);

  // ===== Helper Functions =====

  /**
   * Calculate position order for a player
   * @param {Object} player - Player object
   * @param {boolean} isStarter - Whether player is a starter
   * @param {Array} currentTeam - Current team array
   * @returns {number} Position order (1-12)
   */
  const calculatePositionOrder = (player, isStarter, currentTeam) => {
    if (isStarter) {
      const starters = currentTeam.filter(p => p.isStarter && p.id !== player.id);
      const gkStarters = starters.filter(p => p.position === 'GK').length;
      
      if (player.position === 'GK') {
        return 1;
      } else {
        return gkStarters + starters.filter(p => p.position === 'Outfield').length + 1;
      }
    } else {
      const bench = currentTeam.filter(p => !p.isStarter && p.id !== player.id);
      const gkBench = bench.filter(p => p.position === 'GK').length;
      
      if (player.position === 'GK') {
        return 8;
      } else {
        return 8 + gkBench + bench.filter(p => p.position === 'Outfield').length + 1;
      }
    }
  };

  // ===== Validation Functions =====

  /**
   * Check if a player can be added to the team
   * @param {Object} player - Player object to check
   * @returns {Object} { canAdd: boolean, reason: string }
   */
  const canAddPlayer = (player) => {
    // Check if player already in team
    if (selectedPlayers.some((p) => p.id === player.id)) {
      return { canAdd: false, reason: 'You already have this player in your team.' };
    }

    // Check team size limit
    if (selectedPlayers.length >= MAX_PLAYERS) {
      return { canAdd: false, reason: `Team is full (${MAX_PLAYERS}/${MAX_PLAYERS} players).` };
    }

    // Check budget
    if (remainingBudget < player.price) {
      const needed = (player.price - remainingBudget).toFixed(1);
      return { canAdd: false, reason: `Budget exceeded! You need $${needed}M more.` };
    }

    // Check position limits
    if (player.position === 'GK' && goalkeepersCount >= MAX_GOALKEEPERS) {
      return {
        canAdd: false,
        reason: `You already have ${MAX_GOALKEEPERS} goalkeepers (maximum allowed).`,
      };
    }

    if (player.position === 'Outfield' && outfieldCount >= MAX_OUTFIELD) {
      return {
        canAdd: false,
        reason: `You already have ${MAX_OUTFIELD} field players (maximum allowed).`,
      };
    }

    return { canAdd: true, reason: '' };
  };

  /**
   * Validate if a player can be set as starter
   * @param {Object} player - Player object
   * @param {boolean} currentIsStarter - Current starter status
   * @returns {Object} { canSet: boolean, reason: string }
   */
  const canSetAsStarter = (player, currentIsStarter) => {
    // If already a starter and trying to set as starter, no change needed
    if (currentIsStarter) {
      return { canSet: true, reason: '' };
    }

    // Check total starters limit
    if (startersCount >= MAX_STARTERS) {
      return {
        canSet: false,
        reason: `You already have ${MAX_STARTERS} starters (maximum allowed).`,
      };
    }

    // Check position-specific limits
    if (player.position === 'GK' && gkStartersCount >= MAX_GK_STARTERS) {
      return {
        canSet: false,
        reason: `You already have ${MAX_GK_STARTERS} goalkeeper as starter (maximum allowed).`,
      };
    }

    if (player.position === 'Outfield' && outfieldStartersCount >= MAX_OUTFIELD_STARTERS) {
      return {
        canSet: false,
        reason: `You already have ${MAX_OUTFIELD_STARTERS} field players as starters (maximum allowed).`,
      };
    }

    return { canSet: true, reason: '' };
  };

  /**
   * Validate if a player can be set as substitute
   * @param {Object} player - Player object
   * @param {boolean} currentIsStarter - Current starter status
   * @returns {Object} { canSet: boolean, reason: string }
   */
  const canSetAsSubstitute = (player, currentIsStarter) => {
    // If already a substitute and trying to set as substitute, no change needed
    if (!currentIsStarter) {
      return { canSet: true, reason: '' };
    }

    // Check total substitutes limit
    if (substitutesCount >= MAX_SUBSTITUTES) {
      return {
        canSet: false,
        reason: `You already have ${MAX_SUBSTITUTES} substitutes (maximum allowed).`,
      };
    }

    // Check position-specific limits
    if (player.position === 'GK' && gkSubstitutesCount >= MAX_GK_SUBSTITUTES) {
      return {
        canSet: false,
        reason: `You already have ${MAX_GK_SUBSTITUTES} goalkeeper as substitute (maximum allowed).`,
      };
    }

    if (player.position === 'Outfield' && outfieldSubstitutesCount >= MAX_OUTFIELD_SUBSTITUTES) {
      return {
        canSet: false,
        reason: `You already have ${MAX_OUTFIELD_SUBSTITUTES} field players as substitutes (maximum allowed).`,
      };
    }

    return { canSet: true, reason: '' };
  };

  // ===== Team Management Functions =====

  /**
   * Add a player to the team
   * @param {Object} player - Player object to add
   * @param {boolean} isStarter - Whether to add as starter (default: auto-determine)
   */
  const addPlayer = async (player, isStarter = null) => {
    // Validate if player can be added
    const validation = canAddPlayer(player);
    if (!validation.canAdd) {
      Alert.alert('Cannot Add Player', validation.reason);
      return { success: false, error: validation.reason };
    }

    // Auto-determine starter status if not explicitly provided
    if (isStarter === null) {
      // Check if there's room in starting lineup for this position
      if (player.position === 'GK' && gkStartersCount < MAX_GK_STARTERS) {
        isStarter = true;
      } else if (player.position === 'Outfield' && outfieldStartersCount < MAX_OUTFIELD_STARTERS) {
        isStarter = true;
      } else {
        isStarter = false;
      }
    }

    // If explicitly adding as starter, validate starter rules
    if (isStarter) {
      const starterValidation = canSetAsStarter(player, false);
      if (!starterValidation.canSet) {
        Alert.alert('Cannot Add as Starter', starterValidation.reason);
        // Add as substitute instead
        isStarter = false;
      }
    }

    // Calculate position_order
    let positionOrder = null;
    
    if (isStarter) {
      // Starters: order 1-7
      const currentStarters = selectedPlayers.filter(p => p.isStarter);
      const gkStarters = currentStarters.filter(p => p.position === 'GK').length;
      
      if (player.position === 'GK') {
        positionOrder = 1; // GK is always position 1
      } else {
        // Outfield starters start at position 2
        positionOrder = gkStarters + currentStarters.filter(p => p.position === 'Outfield').length + 1;
      }
    } else {
      // Bench: order 8-12
      const currentBench = selectedPlayers.filter(p => !p.isStarter);
      const gkBench = currentBench.filter(p => p.position === 'GK').length;
      
      if (player.position === 'GK') {
        positionOrder = 8; // Bench GK is always position 8
      } else {
        // Outfield bench starts at position 9
        positionOrder = 8 + gkBench + currentBench.filter(p => p.position === 'Outfield').length + 1;
      }
    }

    try {
      // Optimistic update: Update local state immediately
      const newPlayer = { ...player, isStarter, positionOrder };
      setSelectedPlayers((prev) => [...prev, newPlayer]);

      // Save to Supabase
      const { error } = await userTeamService.addPlayerToTeam(userId, player.id, isStarter, positionOrder);

      if (error) {
        // Revert optimistic update on error
        setSelectedPlayers((prev) => prev.filter((p) => p.id !== player.id));
        Alert.alert('Error', 'Failed to add player to team. Please try again.');
        return { success: false, error };
      }

      // Auto-assign captain if this is the first starter and no captain exists
      if (isStarter && !captainId) {
        await userTeamService.updateCaptain(userId, player.id);
        setCaptainId(player.id);
        setSelectedPlayers(prev => prev.map(p => ({
          ...p,
          isCaptain: p.id === player.id
        })));
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error in addPlayer:', error);
      // Revert optimistic update on error
      setSelectedPlayers((prev) => prev.filter((p) => p.id !== player.id));
      Alert.alert('Error', 'Failed to add player to team. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Remove a player from the team
   * @param {string} playerId - Player ID to remove
   */
  const removePlayer = async (playerId) => {
    const playerToRemove = selectedPlayers.find((p) => p.id === playerId);
    if (!playerToRemove) {
      return { success: false, error: 'Player not found in team' };
    }

    try {
      // Check if removing captain
      const removingCaptain = playerId === captainId;
      const previousCaptainId = captainId;
      
      // Optimistic update: Update local state immediately
      setSelectedPlayers((prev) => prev.filter((p) => p.id !== playerId));

      // If removing captain, find new captain among remaining starters
      if (removingCaptain) {
        const remainingStarters = selectedPlayers.filter(p => 
          p.id !== playerId && p.isStarter
        );
        
        if (remainingStarters.length > 0) {
          const newCaptain = remainingStarters[0];
          setCaptainId(newCaptain.id);
          setSelectedPlayers(prev => prev.map(p => ({
            ...p,
            isCaptain: p.id === newCaptain.id
          })));
          await userTeamService.updateCaptain(userId, newCaptain.id);
        } else {
          setCaptainId(null);
        }
      }

      // Remove from Supabase
      const { error } = await userTeamService.removePlayerFromTeam(userId, playerId);

      if (error) {
        // Revert optimistic update on error
        setSelectedPlayers((prev) => [...prev, playerToRemove]);
        setCaptainId(previousCaptainId);
        Alert.alert('Error', 'Failed to remove player from team. Please try again.');
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error in removePlayer:', error);
      // Revert optimistic update on error
      setSelectedPlayers((prev) => [...prev, playerToRemove]);
      Alert.alert('Error', 'Failed to remove player from team. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Set a player as starter or substitute
   * @param {string} playerId - Player ID
   * @param {boolean} isStarter - Whether player should be a starter
   */
  const setPlayerAsStarter = async (playerId, isStarter) => {
    const player = selectedPlayers.find((p) => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found in team' };
    }

    // No change needed if already in desired state
    if (player.isStarter === isStarter) {
      return { success: true, error: null };
    }

    // Validate the change
    const validation = isStarter
      ? canSetAsStarter(player, player.isStarter)
      : canSetAsSubstitute(player, player.isStarter);

    if (!validation.canSet) {
      Alert.alert('Cannot Change Status', validation.reason);
      return { success: false, error: validation.reason };
    }

    try {
      // Store previous state for potential rollback
      const previousState = [...selectedPlayers];

      // Optimistic update: Update local state immediately
      setSelectedPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, isStarter } : p))
      );

      // Update in Supabase
      const { error } = await userTeamService.updatePlayerStatus(userId, playerId, isStarter);

      if (error) {
        // Revert optimistic update on error
        setSelectedPlayers(previousState);
        Alert.alert('Error', 'Failed to update player status. Please try again.');
        return { success: false, error };
      }

      // Auto-assign captain if this is the first starter and no captain exists
      if (isStarter && !captainId) {
        await userTeamService.updateCaptain(userId, playerId);
        setCaptainId(playerId);
        setSelectedPlayers(prev => prev.map(p => ({
          ...p,
          isCaptain: p.id === playerId
        })));
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error in setPlayerAsStarter:', error);
      // Revert to previous state on error
      await loadUserTeam();
      Alert.alert('Error', 'Failed to update player status. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Clear the entire team
   */
  const clearTeam = async () => {
    try {
      // Store previous state for potential rollback
      const previousState = [...selectedPlayers];
      const previousCaptainId = captainId;

      // Optimistic update: Clear local state immediately
      setSelectedPlayers([]);
      setCaptainId(null);

      // Clear from Supabase
      const { error } = await userTeamService.clearUserTeam(userId);

      if (error) {
        // Revert optimistic update on error
        setSelectedPlayers(previousState);
        setCaptainId(previousCaptainId);
        Alert.alert('Error', 'Failed to clear team. Please try again.');
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error in clearTeam:', error);
      // Reload team on error
      await loadUserTeam();
      Alert.alert('Error', 'Failed to clear team. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Perform a transfer: swap playerOut for playerIn.
   * In the unlimited pre-GW1 phase this is free.
   * After GW1 it consumes a free transfer or costs -4 points.
   *
   * This is implemented as a single atomic state update (one setSelectedPlayers
   * call) to avoid the stale-state race condition that occurred when removePlayer
   * and addPlayer were called sequentially — the canAddPlayer validation was
   * reading the un-updated selectedPlayers and incorrectly seeing a full team.
   *
   * @param {Object} playerOut - Player being removed
   * @param {Object} playerIn  - Player being added
   * @returns {Promise<{success: boolean, error: any, usesFreeTransfer: boolean, pointCost: number}>}
   */
  const makeTransfer = async (playerOut, playerIn) => {
    const fail = (error) => ({ success: false, error, usesFreeTransfer: false, pointCost: 0 });

    // Find the outgoing player's current slot so the incoming player inherits it
    const outgoingPlayer = selectedPlayers.find((p) => p.id === playerOut.id);
    if (!outgoingPlayer) {
      Alert.alert('Transfer Error', 'The player you are replacing was not found in your team.');
      return fail('Player not found in team');
    }

    // Validate playerIn against the team AS IT WILL BE after the remove,
    // without touching React state at all.
    const teamAfterRemove = selectedPlayers.filter((p) => p.id !== playerOut.id);

    if (teamAfterRemove.some((p) => p.id === playerIn.id)) {
      Alert.alert('Cannot Add Player', 'You already have this player in your team.');
      return fail('Already in team');
    }

    const budgetAfterRemove = remainingBudget + outgoingPlayer.price;
    if (budgetAfterRemove < playerIn.price) {
      const needed = (playerIn.price - budgetAfterRemove).toFixed(1);
      Alert.alert('Cannot Add Player', `Budget exceeded! You need $${needed}M more.`);
      return fail('Budget exceeded');
    }

    const gkCountAfter = teamAfterRemove.filter((p) => p.position === 'GK').length;
    if (playerIn.position === 'GK' && gkCountAfter >= MAX_GOALKEEPERS) {
      Alert.alert('Cannot Add Player', `You already have ${MAX_GOALKEEPERS} goalkeepers (maximum allowed).`);
      return fail('Too many goalkeepers');
    }

    const outfieldCountAfter = teamAfterRemove.filter((p) => p.position === 'Outfield').length;
    if (playerIn.position === 'Outfield' && outfieldCountAfter >= MAX_OUTFIELD) {
      Alert.alert('Cannot Add Player', `You already have ${MAX_OUTFIELD} field players (maximum allowed).`);
      return fail('Too many outfield players');
    }

    // Incoming player inherits the exact slot (isStarter + positionOrder) of the
    // player they are replacing, so pitch layout is preserved.
    const incomingPlayer = {
      ...playerIn,
      isStarter: outgoingPlayer.isStarter,
      positionOrder: outgoingPlayer.positionOrder,
      isCaptain: false,
    };

    // Determine whether the captain changes
    const previousCaptainId = captainId;
    let newCaptainId = captainId;
    if (captainId === playerOut.id) {
      // Incoming player takes the same slot — hand them the armband
      newCaptainId = incomingPlayer.id;
      incomingPlayer.isCaptain = true;
    }

    // Atomic swap: replace playerOut with incomingPlayer in one state update
    setSelectedPlayers((prev) =>
      prev.map((p) => (p.id === playerOut.id ? incomingPlayer : p))
    );

    if (newCaptainId !== previousCaptainId) {
      setCaptainId(newCaptainId);
    }

    // Run Supabase remove + add in parallel
    try {
      const [removeResult, addResult] = await Promise.all([
        userTeamService.removePlayerFromTeam(userId, playerOut.id),
        userTeamService.addPlayerToTeam(
          userId,
          playerIn.id,
          incomingPlayer.isStarter,
          incomingPlayer.positionOrder
        ),
      ]);

      if (removeResult.error || addResult.error) {
        // Revert optimistic state
        setSelectedPlayers((prev) =>
          prev.map((p) => (p.id === playerIn.id ? outgoingPlayer : p))
        );
        setCaptainId(previousCaptainId);
        Alert.alert('Transfer Error', 'Failed to complete transfer. Please try again.');
        return fail(removeResult.error || addResult.error);
      }

      // Persist captain change to DB if needed
      if (newCaptainId !== previousCaptainId && newCaptainId) {
        await userTeamService.updateCaptain(userId, newCaptainId);
        setSelectedPlayers((prev) =>
          prev.map((p) => ({ ...p, isCaptain: p.id === newCaptainId }))
        );
      }
    } catch (error) {
      // Revert optimistic state
      setSelectedPlayers((prev) =>
        prev.map((p) => (p.id === playerIn.id ? outgoingPlayer : p))
      );
      setCaptainId(previousCaptainId);
      Alert.alert('Transfer Error', 'Failed to complete transfer. Please try again.');
      return fail(error);
    }

    // In unlimited phase no transfer bookkeeping needed
    if (isUnlimitedPhase) {
      return { success: true, error: null, usesFreeTransfer: false, pointCost: 0 };
    }

    // Record the transfer and update local state
    const transferResult = await transferService.recordTransfer(
      userId,
      freeTransfers,
      pendingDeductions,
      transfersMadeThisRound,
      currentRound?.id
    );

    if (!transferResult.error && transferResult.data) {
      setFreeTransfers(transferResult.data.free_transfers);
      setPendingDeductions(transferResult.data.pending_deductions);
      setTransfersMadeThisRound(transferResult.data.transfers_made_this_round);
    }

    return {
      success: true,
      error: null,
      usesFreeTransfer: transferResult.usesFreeTransfer ?? true,
      pointCost: transferResult.pointCost ?? 0,
    };
  };

  /**
   * Swap two players' starter/substitute status
   * @param {string} playerId1 - First player ID
   * @param {string} playerId2 - Second player ID
   * @returns {Promise<{success: boolean, error: any}>}
   */
  const swapPlayers = async (playerId1, playerId2) => {
    const player1 = selectedPlayers.find(p => p.id === playerId1);
    const player2 = selectedPlayers.find(p => p.id === playerId2);
    
    if (!player1 || !player2) {
      return { success: false, error: 'Players not found' };
    }
    
    // Validate same position
    if (player1.position !== player2.position) {
      Alert.alert('Invalid Swap', 'You can only swap players in the same position (GK with GK, Outfield with Outfield).');
      return { success: false, error: 'Position mismatch' };
    }
    
    try {
      // Store previous state for rollback
      const previousState = [...selectedPlayers];
      const previousCaptainId = captainId;
      
      // Check if captain is being moved to bench
      const captainMovingToBench = (player1.id === captainId && player1.isStarter) || 
                                     (player2.id === captainId && player2.isStarter);
      
      // Determine new starters after swap
      const getNewStarterStatus = (p) => {
        if (p.id === playerId1) return player2.isStarter;
        if (p.id === playerId2) return player1.isStarter;
        return p.isStarter;
      };
      
      // If captain moving to bench, find the first available starter to become new captain
      let newCaptainId = captainId;
      if (captainMovingToBench) {
        const remainingStarters = selectedPlayers.filter(p => 
          getNewStarterStatus(p) && p.id !== player1.id && p.id !== player2.id
        );
        
        // Add the player who is becoming a starter (if any)
        const playerBecomingStarter = player1.isStarter ? player2 : player1;
        if (getNewStarterStatus(playerBecomingStarter)) {
          remainingStarters.push(playerBecomingStarter);
        }
        
        // Auto-assign captain to first starter
        if (remainingStarters.length > 0) {
          newCaptainId = remainingStarters[0].id;
        } else {
          newCaptainId = null;
        }
      }
      
      // Optimistic update: Swap their isStarter status and update captain
      setSelectedPlayers(prev => prev.map(p => {
        const newIsStarter = getNewStarterStatus(p);
        return { 
          ...p, 
          isStarter: newIsStarter,
          isCaptain: p.id === newCaptainId && newIsStarter
        };
      }));
      
      // Update captain state
      setCaptainId(newCaptainId);
      
      // If captain changed, update in database
      if (captainMovingToBench) {
        if (newCaptainId) {
          await userTeamService.updateCaptain(userId, newCaptainId);
        } else {
          // No starters left, clear captain
          await supabase
            .from('user_teams')
            .update({ is_captain: false })
            .eq('user_id', userId);
        }
      }
      
      // Recalculate position_order for both players after swap
      const updatedTeam = selectedPlayers.map(p => {
        const newIsStarter = getNewStarterStatus(p);
        return { ...p, isStarter: newIsStarter };
      });
      
      const player1NewOrder = calculatePositionOrder(player1, player2.isStarter, updatedTeam);
      const player2NewOrder = calculatePositionOrder(player2, player1.isStarter, updatedTeam);
      
      // Update optimistic state with new position orders
      setSelectedPlayers(prev => prev.map(p => {
        if (p.id === playerId1) return { ...p, positionOrder: player1NewOrder };
        if (p.id === playerId2) return { ...p, positionOrder: player2NewOrder };
        return p;
      }));
      
      // Update both players in database (status and position_order)
      const update1 = userTeamService.updatePlayerStatus(userId, playerId1, player2.isStarter);
      const update2 = userTeamService.updatePlayerStatus(userId, playerId2, player1.isStarter);
      const updateOrder1 = userTeamService.updatePlayerPositionOrder(userId, playerId1, player1NewOrder);
      const updateOrder2 = userTeamService.updatePlayerPositionOrder(userId, playerId2, player2NewOrder);
      
      const [result1, result2, orderResult1, orderResult2] = await Promise.all([
        update1, 
        update2, 
        updateOrder1, 
        updateOrder2
      ]);
      
      if (result1.error || result2.error || orderResult1.error || orderResult2.error) {
        // Revert on error
        setSelectedPlayers(previousState);
        setCaptainId(previousCaptainId);
        Alert.alert('Error', 'Failed to swap players. Please try again.');
        return { success: false, error: result1.error || result2.error || orderResult1.error || orderResult2.error };
      }
      
      return { success: true, error: null };
    } catch (error) {
      console.error('Error in swapPlayers:', error);
      await loadUserTeam();
      Alert.alert('Error', 'Failed to swap players. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Reorder two outfield substitutes by swapping their positionOrder values.
   * Does not change isStarter status — only affects substitution priority.
   * @param {string} playerId1 - First outfield sub ID
   * @param {string} playerId2 - Second outfield sub ID
   * @returns {Promise<{success: boolean, error: any}>}
   */
  const reorderOutfieldSubs = async (playerId1, playerId2) => {
    const player1 = selectedPlayers.find(p => p.id === playerId1);
    const player2 = selectedPlayers.find(p => p.id === playerId2);

    if (!player1 || !player2) {
      return { success: false, error: 'Players not found' };
    }

    if (player1.isStarter || player2.isStarter ||
        player1.position !== 'Outfield' || player2.position !== 'Outfield') {
      return { success: false, error: 'Both players must be outfield substitutes' };
    }

    try {
      const previousState = [...selectedPlayers];
      const order1 = player1.positionOrder;
      const order2 = player2.positionOrder;

      // Optimistic update: swap their positionOrder values
      setSelectedPlayers(prev => prev.map(p => {
        if (p.id === playerId1) return { ...p, positionOrder: order2 };
        if (p.id === playerId2) return { ...p, positionOrder: order1 };
        return p;
      }));

      const [result1, result2] = await Promise.all([
        userTeamService.updatePlayerPositionOrder(userId, playerId1, order2),
        userTeamService.updatePlayerPositionOrder(userId, playerId2, order1),
      ]);

      if (result1.error || result2.error) {
        setSelectedPlayers(previousState);
        Alert.alert('Error', 'Failed to reorder substitutes. Please try again.');
        return { success: false, error: result1.error || result2.error };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error in reorderOutfieldSubs:', error);
      await loadUserTeam();
      Alert.alert('Error', 'Failed to reorder substitutes. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Get validation messages for incomplete team
   * @returns {Array<string>} Array of validation messages
   */
  const getValidationMessages = () => {
    const messages = [];

    // Check total players
    if (selectedPlayers.length < MAX_PLAYERS) {
      messages.push(`You need ${MAX_PLAYERS - selectedPlayers.length} more players to complete your team.`);
    }

    // Check goalkeepers
    if (goalkeepersCount < MAX_GOALKEEPERS) {
      messages.push(`You need ${MAX_GOALKEEPERS - goalkeepersCount} more goalkeeper(s) (need 2 total: 1 starter + 1 sub).`);
    }

    // Check outfield players
    if (outfieldCount < MAX_OUTFIELD) {
      messages.push(`You need ${MAX_OUTFIELD - outfieldCount} more field players (need 10 total).`);
    }

    // Check starters
    if (startersCount < MAX_STARTERS && selectedPlayers.length === MAX_PLAYERS) {
      messages.push(`Select exactly ${MAX_STARTERS} starters (1 GK + 6 Outfield).`);
    }

    // Check GK starter
    if (gkStartersCount < MAX_GK_STARTERS && goalkeepersCount >= MAX_GOALKEEPERS) {
      messages.push(`You must have exactly 1 goalkeeper as a starter.`);
    }

    // Check outfield starters
    if (outfieldStartersCount < MAX_OUTFIELD_STARTERS && outfieldCount >= MAX_OUTFIELD) {
      messages.push(`Select ${MAX_OUTFIELD_STARTERS - outfieldStartersCount} more field players as starters (need 6 total).`);
    }

    // Check GK substitute
    if (gkSubstitutesCount < MAX_GK_SUBSTITUTES && goalkeepersCount >= MAX_GOALKEEPERS) {
      messages.push(`You must have exactly 1 goalkeeper as a substitute.`);
    }

    return messages;
  };

  /**
   * Check if team is complete and valid
   * @returns {boolean}
   */
  const isTeamValid = () => {
    return (
      selectedPlayers.length === MAX_PLAYERS &&
      goalkeepersCount === MAX_GOALKEEPERS &&
      outfieldCount === MAX_OUTFIELD &&
      startersCount === MAX_STARTERS &&
      gkStartersCount === MAX_GK_STARTERS &&
      outfieldStartersCount === MAX_OUTFIELD_STARTERS &&
      gkSubstitutesCount === MAX_GK_SUBSTITUTES &&
      outfieldSubstitutesCount === MAX_OUTFIELD_SUBSTITUTES
    );
  };

  /**
   * Set a player as captain
   * Captain must be a starter and only one captain allowed
   * @param {string} playerId - Player ID to set as captain
   * @param {boolean} isRoundLocked - Whether the current round is locked (passed from RoundContext)
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  const setCaptain = async (playerId, isRoundLocked = false) => {
    const player = selectedPlayers.find(p => p.id === playerId);
    
    // Validation
    if (!player) {
      return { success: false, error: 'Player not in team' };
    }
    
    if (!player.isStarter) {
      Alert.alert('Invalid Captain', 'Captain must be a starter (one of your 7 starting players).');
      return { success: false, error: 'Captain must be a starter' };
    }
    
    // Check if round is locked
    if (isRoundLocked) {
      Alert.alert('Team Locked', 'Cannot change captain after deadline.');
      return { success: false, error: 'Round is locked' };
    }
    
    try {
      // Update in database
      const { error } = await userTeamService.updateCaptain(userId, playerId);
      if (error) throw error;
      
      // Update local state
      setCaptainId(playerId);
      setSelectedPlayers(prev => prev.map(p => ({
        ...p,
        isCaptain: p.id === playerId
      })));
      
      return { success: true, error: null };
    } catch (error) {
      console.error('Error setting captain:', error);
      Alert.alert('Error', 'Failed to set captain. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Calculate total gameweek points for the team.
   *
   * - If the round is locked (deadline has passed), scores are read from the
   *   saved user_gw_picks snapshot so that post-deadline transfers never
   *   affect an already-locked GW score.
   * - If the round is still open (pre-deadline), scores are calculated from
   *   the live selectedPlayers so the user can see a live preview.
   *
   * @param {string} roundId - Round UUID
   * @returns {Promise<number>}
   */
  const calculateGameweekPoints = async (roundId) => {
    if (!roundId) return 0;

    try {
      if (isLocked && userId) {
        // Round is locked — use the frozen snapshot so transfers can't alter the score
        return await userGwPicksService.calculateLockedGwScore(
          userId,
          roundId,
          pendingDeductions
        );
      }

      // Round still open — live preview from current team
      const starters = selectedPlayers.filter(p => p.isStarter);
      const starterIds = starters.map(p => p.id);

      if (starterIds.length === 0) return 0;

      const { data: pointsMap } = await playerRoundPointsService
        .getMultiplePlayersPointsForRound(starterIds, roundId);

      let total = 0;
      starters.forEach(player => {
        const points = pointsMap[player.id] || 0;
        const multiplier = player.id === captainId ? 2 : 1;
        total += points * multiplier;
      });

      return total - pendingDeductions;
    } catch (error) {
      console.error('Error calculating gameweek points:', error);
      return 0;
    }
  };

  // Context value
  const value = {
    // State
    selectedPlayers,
    userId,
    isLoading,
    captainId,
    teamName,

    // Derived values
    totalSpent,
    remainingBudget,
    startersCount,
    substitutesCount,
    gkStartersCount,
    outfieldStartersCount,
    gkSubstitutesCount,
    outfieldSubstitutesCount,
    goalkeepersCount,
    outfieldCount,
    totalPoints,

    // Transfer state
    freeTransfers,
    transfersMadeThisRound,
    pendingDeductions,
    squadFinalized,
    isUnlimitedPhase,

    // Historical points (locked per-GW snapshots)
    lockedTotalPoints,
    loadLockedTotalPoints,

    // Validation functions
    canAddPlayer,
    canSetAsStarter,
    canSetAsSubstitute,
    getValidationMessages,
    isTeamValid,

    // Team management functions
    addPlayer,
    removePlayer,
    makeTransfer,
    setPlayerAsStarter,
    swapPlayers,
    reorderOutfieldSubs,
    loadUserTeam,
    loadTeamName,
    clearTeam,
    setCaptain,
    updateTeamName: updateTeamNameInContext,
    calculateGameweekPoints,

    // Constants (for UI reference)
    STARTING_BUDGET,
    MAX_PLAYERS,
    MAX_GOALKEEPERS,
    MAX_OUTFIELD,
    MAX_STARTERS,
    MAX_GK_STARTERS,
    MAX_OUTFIELD_STARTERS,
    MAX_SUBSTITUTES,
    MAX_GK_SUBSTITUTES,
    MAX_OUTFIELD_SUBSTITUTES,
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};
