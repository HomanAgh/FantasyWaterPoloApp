import supabase from '../config/supabaseClient';
import {
  fetchAppearanceMap,
  resolveSquadPointsWithAutoSub,
} from './autoSubstitutionService';
import { getMultiplePlayersPointsForRound } from './playerRoundPointsService';

/**
 * Save a snapshot of the user's squad at a gameweek deadline.
 * Uses ignoreDuplicates so it is safe to call multiple times — the first save
 * wins and subsequent calls (e.g. on app re-open during a locked GW) are no-ops.
 *
 * @param {string} userId
 * @param {string} roundId
 * @param {Array}  players   - selectedPlayers array from TeamContext
 * @param {string} captainId - current captain player ID
 */
export const saveGwSnapshot = async (userId, roundId, players, captainId) => {
  try {
    if (!players || players.length === 0) return { data: null, error: null };

    const records = players.map(player => ({
      user_id: userId,
      round_id: roundId,
      player_id: player.id,
      is_starter: player.isStarter ?? false,
      is_captain: player.id === captainId,
      position_order: player.positionOrder ?? null,
    }));

    const { data, error } = await supabase
      .from('user_gw_picks')
      .upsert(records, {
        onConflict: 'user_id,round_id,player_id',
        ignoreDuplicates: true,
      });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error saving GW snapshot:', error);
    return { data: null, error };
  }
};

/**
 * Fetch the saved squad snapshot for a specific user + round.
 * Returns an array of { player_id, is_starter, is_captain, position_order }.
 */
export const getGwPicksForRound = async (userId, roundId) => {
  try {
    const { data, error } = await supabase
      .from('user_gw_picks')
      .select('player_id, is_starter, is_captain, position_order')
      .eq('user_id', userId)
      .eq('round_id', roundId);

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching GW picks:', error);
    return { data: [], error };
  }
};

/**
 * Enrich picks with player position, then score with auto-subs.
 *
 * @param {Array} picks - rows from user_gw_picks (or compatible)
 * @param {string} roundId
 * @returns {Promise<{ total: number, slots: Array, usedBenchIds: Set, picksWithPosition: Array }>}
 */
export const scorePicksWithAutoSub = async (picks, roundId) => {
  if (!picks?.length || !roundId) {
    return { total: 0, slots: [], usedBenchIds: new Set(), picksWithPosition: [] };
  }

  const playerIds = picks.map(p => p.player_id);

  let playerRows = [];
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, position')
      .in('id', playerIds);
    if (error) throw error;
    playerRows = data || [];
  } catch (error) {
    console.error('Error fetching player positions for auto-sub:', error);
  }

  const [appearanceMap, { data: pointsMap }] = await Promise.all([
    fetchAppearanceMap(playerIds, roundId),
    getMultiplePlayersPointsForRound(playerIds, roundId),
  ]);

  const positionById = {};
  playerRows.forEach(p => {
    positionById[p.id] = p.position;
  });

  const picksWithPosition = picks.map(p => ({
    ...p,
    position: p.position || positionById[p.player_id] || 'Outfield',
  }));

  const result = resolveSquadPointsWithAutoSub(
    picksWithPosition,
    appearanceMap,
    pointsMap || {}
  );

  return { ...result, picksWithPosition, appearanceMap, pointsMap: pointsMap || {} };
};

/**
 * Calculate the locked score for a specific past round using the saved snapshot.
 * Applies auto-substitution, then doubles captain slot points.
 *
 * @param {string} userId
 * @param {string} roundId
 * @param {number} pointDeductions - point hit applied for that GW (default 0)
 * @returns {Promise<number>}
 */
export const calculateLockedGwScore = async (userId, roundId, pointDeductions = 0) => {
  try {
    const { data: picks, error: picksError } = await getGwPicksForRound(userId, roundId);
    if (picksError || !picks || picks.length === 0) return 0;

    const { total } = await scorePicksWithAutoSub(picks, roundId);
    return Math.max(0, total - pointDeductions);
  } catch (error) {
    console.error('Error calculating locked GW score:', error);
    return 0;
  }
};

/**
 * Return the unique round IDs for which this user has a saved snapshot.
 */
export const getSnapshotRoundIds = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_gw_picks')
      .select('round_id')
      .eq('user_id', userId);

    if (error) throw error;

    const roundIds = [...new Set(data?.map(r => r.round_id) || [])];
    return { data: roundIds, error: null };
  } catch (error) {
    console.error('Error fetching snapshot round IDs:', error);
    return { data: [], error };
  }
};

/**
 * Fetch the transfer point deduction recorded for a specific past round.
 * Returns 0 if no deduction row exists (free transfer used or no transfers made).
 *
 * @param {string} userId
 * @param {string} roundId
 * @returns {Promise<number>}
 */
export const getDeductionForRound = async (userId, roundId) => {
  try {
    const { data, error } = await supabase
      .from('user_round_deductions')
      .select('deduction')
      .eq('user_id', userId)
      .eq('round_id', roundId)
      .maybeSingle();

    if (error) throw error;

    return data?.deduction ?? 0;
  } catch (error) {
    console.error('Error fetching deduction for round:', error);
    return 0;
  }
};

/**
 * Sum the locked scores from every gameweek snapshot for this user.
 * Each past GW score is calculated from the snapshot taken at that GW's deadline,
 * so it is never affected by later transfers.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
export const calculateTotalLockedPoints = async (userId) => {
  try {
    const { data: roundIds, error } = await getSnapshotRoundIds(userId);
    if (error || !roundIds || roundIds.length === 0) return 0;

    const scores = await Promise.all(
      roundIds.map(roundId => calculateLockedGwScore(userId, roundId))
    );

    return scores.reduce((sum, score) => sum + score, 0);
  } catch (error) {
    console.error('Error calculating total locked points:', error);
    return 0;
  }
};

/**
 * Public (any authenticated user) read of another manager's snapshot round IDs.
 * Uses SECURITY DEFINER RPC — bypasses RLS on user_gw_picks.
 */
export const getPublicSnapshotRoundIds = async (targetUserId) => {
  try {
    const { data, error } = await supabase.rpc('get_user_snapshot_rounds', {
      target_user_id: targetUserId,
    });

    if (error) throw error;

    const roundIds = [...new Set((data || []).map(r => r.round_id))];
    return { data: roundIds, error: null };
  } catch (error) {
    console.error('Error fetching public snapshot round IDs:', error);
    return { data: [], error };
  }
};

/**
 * Public read of another manager's locked GW picks for a round.
 */
export const getPublicGwPicksForRound = async (targetUserId, roundId) => {
  try {
    const { data, error } = await supabase.rpc('get_user_gw_picks_for_round', {
      target_user_id: targetUserId,
      target_round_id: roundId,
    });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching public GW picks:', error);
    return { data: [], error };
  }
};

/**
 * Public read of another manager's transfer deduction for a round.
 */
export const getPublicDeductionForRound = async (targetUserId, roundId) => {
  try {
    const { data, error } = await supabase.rpc('get_user_round_deduction', {
      target_user_id: targetUserId,
      target_round_id: roundId,
    });

    if (error) throw error;

    return typeof data === 'number' ? data : 0;
  } catch (error) {
    console.error('Error fetching public deduction:', error);
    return 0;
  }
};
