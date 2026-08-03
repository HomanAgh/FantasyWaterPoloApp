import supabase from '../config/supabaseClient';

/**
 * Get points for a specific player in a specific round
 * @param {string} playerId - Player UUID
 * @param {string} roundId - Round UUID
 * @returns {Promise<{data: number, error: Error|null}>}
 */
export const getPlayerPointsForRound = async (playerId, roundId) => {
  try {
    const { data, error } = await supabase
      .from('player_round_points')
      .select('points')
      .eq('player_id', playerId)
      .eq('round_id', roundId)
      .maybeSingle();
    
    if (error) throw error;
    
    return { data: data?.points || 0, error: null };
  } catch (error) {
    console.error('Error fetching player points for round:', error);
    return { data: 0, error };
  }
};

/**
 * Batch fetch points for multiple players in a specific round
 * Returns a map of playerId -> points for efficient lookup
 * @param {Array<string>} playerIds - Array of player UUIDs
 * @param {string} roundId - Round UUID
 * @returns {Promise<{data: Object, error: Error|null}>}
 */
export const getMultiplePlayersPointsForRound = async (playerIds, roundId) => {
  try {
    if (!playerIds || playerIds.length === 0) {
      return { data: {}, error: null };
    }
    
    const { data, error } = await supabase
      .from('player_round_points')
      .select('player_id, points')
      .eq('round_id', roundId)
      .in('player_id', playerIds);
    
    if (error) throw error;
    
    // Convert array to map: playerId -> points
    const pointsMap = {};
    data?.forEach(item => {
      pointsMap[item.player_id] = item.points;
    });
    
    // Ensure all requested players have an entry (default to 0)
    playerIds.forEach(playerId => {
      if (!(playerId in pointsMap)) {
        pointsMap[playerId] = 0;
      }
    });
    
    return { data: pointsMap, error: null };
  } catch (error) {
    console.error('Error fetching multiple players points for round:', error);
    return { data: {}, error };
  }
};

/**
 * Get all points for a player across all rounds
 * @param {string} playerId - Player UUID
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const getPlayerPointsHistory = async (playerId) => {
  try {
    const { data, error } = await supabase
      .from('player_round_points')
      .select(`
        points,
        round_id,
        rounds (
          round_number,
          start_date,
          end_date
        )
      `)
      .eq('player_id', playerId)
      .order('rounds(round_number)', { ascending: true });
    
    if (error) throw error;
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching player points history:', error);
    return { data: [], error };
  }
};

/**
 * Update or insert points for a player in a round (admin function)
 * Uses upsert to handle both insert and update cases
 * @param {string} playerId - Player UUID
 * @param {string} roundId - Round UUID
 * @param {number} points - Points to set
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const updatePlayerPointsForRound = async (playerId, roundId, points) => {
  try {
    const { data, error } = await supabase
      .from('player_round_points')
      .upsert({
        player_id: playerId,
        round_id: roundId,
        points: points,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'player_id,round_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error updating player points for round:', error);
    return { data: null, error };
  }
};

/**
 * Batch update points for multiple players in a round (admin function)
 * @param {Array<{playerId: string, points: number}>} playerPoints - Array of player/points pairs
 * @param {string} roundId - Round UUID
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const batchUpdatePlayerPoints = async (playerPoints, roundId) => {
  try {
    const records = playerPoints.map(({ playerId, points }) => ({
      player_id: playerId,
      round_id: roundId,
      points: points,
      updated_at: new Date().toISOString()
    }));
    
    const { data, error } = await supabase
      .from('player_round_points')
      .upsert(records, {
        onConflict: 'player_id,round_id'
      })
      .select();
    
    if (error) throw error;
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error batch updating player points:', error);
    return { data: [], error };
  }
};

/**
 * Get top scorers for a specific round
 * @param {string} roundId - Round UUID
 * @param {number} limit - Number of top scorers to return (default: 10)
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const getTopScorersForRound = async (roundId, limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('player_round_points')
      .select(`
        points,
        players (
          id,
          name,
          position,
          teams (
            name
          )
        )
      `)
      .eq('round_id', roundId)
      .order('points', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching top scorers for round:', error);
    return { data: [], error };
  }
};
