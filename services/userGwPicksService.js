import supabase from '../config/supabaseClient';

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
 * Returns an array of { player_id, is_starter, is_captain }.
 */
export const getGwPicksForRound = async (userId, roundId) => {
  try {
    const { data, error } = await supabase
      .from('user_gw_picks')
      .select('player_id, is_starter, is_captain')
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
 * Calculate the locked score for a specific past round using the saved snapshot.
 * Joins user_gw_picks → player_round_points, doubles captain points.
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

    const starters = picks.filter(p => p.is_starter);
    if (starters.length === 0) return 0;

    const starterIds = starters.map(p => p.player_id);
    const captainPick = starters.find(p => p.is_captain);
    const captainPlayerId = captainPick?.player_id;

    const { data: pointsData, error: pointsError } = await supabase
      .from('player_round_points')
      .select('player_id, points')
      .eq('round_id', roundId)
      .in('player_id', starterIds);

    if (pointsError) throw pointsError;

    const pointsMap = {};
    pointsData?.forEach(item => {
      pointsMap[item.player_id] = item.points;
    });

    let total = 0;
    starters.forEach(pick => {
      const pts = pointsMap[pick.player_id] || 0;
      const multiplier = pick.player_id === captainPlayerId ? 2 : 1;
      total += pts * multiplier;
    });

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
