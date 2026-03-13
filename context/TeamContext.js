import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { getUserId } from '../utils/userIdHelper';
import * as userTeamService from '../services/userTeamService';
import * as playerRoundPointsService from '../services/playerRoundPointsService';

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

  // Initialize user ID and load team on mount
  useEffect(() => {
    initializeTeam();
  }, []);

  /**
   * Initialize user ID and load their team
   */
  const initializeTeam = async () => {
    try {
      setIsLoading(true);
      const id = await getUserId();
      setUserId(id);
      await loadUserTeam(id);
    } catch (error) {
      console.error('Error initializing team:', error);
      Alert.alert('Error', 'Failed to initialize team. Please restart the app.');
    } finally {
      setIsLoading(false);
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
      setCaptainId(captain?.id || null);
    } catch (error) {
      console.error('Error in loadUserTeam:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== Derived Values =====

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
   * @param {boolean} isStarter - Whether to add as starter (default: false)
   */
  const addPlayer = async (player, isStarter = false) => {
    // Validate if player can be added
    const validation = canAddPlayer(player);
    if (!validation.canAdd) {
      Alert.alert('Cannot Add Player', validation.reason);
      return { success: false, error: validation.reason };
    }

    // If adding as starter, validate starter rules
    if (isStarter) {
      const starterValidation = canSetAsStarter(player, false);
      if (!starterValidation.canSet) {
        Alert.alert('Cannot Add as Starter', starterValidation.reason);
        // Add as substitute instead
        isStarter = false;
      }
    }

    try {
      // Optimistic update: Update local state immediately
      const newPlayer = { ...player, isStarter };
      setSelectedPlayers((prev) => [...prev, newPlayer]);

      // Save to Supabase
      const { error } = await userTeamService.addPlayerToTeam(userId, player.id, isStarter);

      if (error) {
        // Revert optimistic update on error
        setSelectedPlayers((prev) => prev.filter((p) => p.id !== player.id));
        Alert.alert('Error', 'Failed to add player to team. Please try again.');
        return { success: false, error };
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
      // Optimistic update: Update local state immediately
      setSelectedPlayers((prev) => prev.filter((p) => p.id !== playerId));

      // Remove from Supabase
      const { error } = await userTeamService.removePlayerFromTeam(userId, playerId);

      if (error) {
        // Revert optimistic update on error
        setSelectedPlayers((prev) => [...prev, playerToRemove]);
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

      // Optimistic update: Clear local state immediately
      setSelectedPlayers([]);

      // Clear from Supabase
      const { error } = await userTeamService.clearUserTeam(userId);

      if (error) {
        // Revert optimistic update on error
        setSelectedPlayers(previousState);
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
   * Calculate total gameweek points for the team
   * Includes captain bonus (2x points)
   * @param {string} roundId - Round UUID
   * @returns {Promise<number>}
   */
  const calculateGameweekPoints = async (roundId) => {
    if (!roundId) return 0;
    
    try {
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
      
      return total;
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

    // Validation functions
    canAddPlayer,
    canSetAsStarter,
    canSetAsSubstitute,
    getValidationMessages,
    isTeamValid,

    // Team management functions
    addPlayer,
    removePlayer,
    setPlayerAsStarter,
    loadUserTeam,
    clearTeam,
    setCaptain,
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
