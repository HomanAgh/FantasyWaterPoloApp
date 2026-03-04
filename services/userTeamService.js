import supabase from '../config/supabaseClient';

/**
 * Fetch user's team with full player and team details
 * @param {string} userId - User ID
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const getUserTeam = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_teams')
      .select(`
        *,
        players (
          id,
          name,
          position,
          price,
          points_total,
          team_id,
          teams (
            id,
            name,
            league
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Transform data for UI consumption
    const transformedData = data?.map((userTeam) => ({
      id: userTeam.players.id,
      name: userTeam.players.name,
      position: userTeam.players.position,
      team: userTeam.players.teams?.name || 'Unknown',
      teamId: userTeam.players.team_id,
      price: parseFloat(userTeam.players.price),
      points: userTeam.players.points_total || 0,
      isStarter: userTeam.is_starter,
      positionOrder: userTeam.position_order,
    })) || [];

    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Error fetching user team:', error);
    return { data: null, error };
  }
};

/**
 * Add a player to user's team
 * @param {string} userId - User ID
 * @param {string} playerId - Player UUID
 * @param {boolean} isStarter - Whether player is a starter (default: false)
 * @returns {Promise<{data: Object, error: Error|null}>}
 */
export const addPlayerToTeam = async (userId, playerId, isStarter = false) => {
  try {
    const { data, error } = await supabase
      .from('user_teams')
      .insert({
        user_id: userId,
        player_id: playerId,
        is_starter: isStarter,
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error adding player to team:', error);
    return { data: null, error };
  }
};

/**
 * Remove a player from user's team
 * @param {string} userId - User ID
 * @param {string} playerId - Player UUID
 * @returns {Promise<{data: Object, error: Error|null}>}
 */
export const removePlayerFromTeam = async (userId, playerId) => {
  try {
    const { data, error } = await supabase
      .from('user_teams')
      .delete()
      .eq('user_id', userId)
      .eq('player_id', playerId)
      .select();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error removing player from team:', error);
    return { data: null, error };
  }
};

/**
 * Update player's starter/substitute status
 * @param {string} userId - User ID
 * @param {string} playerId - Player UUID
 * @param {boolean} isStarter - Whether player should be a starter
 * @returns {Promise<{data: Object, error: Error|null}>}
 */
export const updatePlayerStatus = async (userId, playerId, isStarter) => {
  try {
    const { data, error } = await supabase
      .from('user_teams')
      .update({ is_starter: isStarter })
      .eq('user_id', userId)
      .eq('player_id', playerId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error updating player status:', error);
    return { data: null, error };
  }
};

/**
 * Clear all players from user's team
 * @param {string} userId - User ID
 * @returns {Promise<{data: Object, error: Error|null}>}
 */
export const clearUserTeam = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_teams')
      .delete()
      .eq('user_id', userId)
      .select();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error clearing user team:', error);
    return { data: null, error };
  }
};
