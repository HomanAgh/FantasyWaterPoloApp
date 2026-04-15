import supabase from '../config/supabaseClient';

/**
 * Fetch all players with their team information
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const fetchPlayers = async () => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select(`
        *,
        teams (
          id,
          name,
          league
        )
      `)
      .order('name', { ascending: true });

    if (error) throw error;

    // Transform data for UI consumption
    const transformedData = data?.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position, // 'GK' or 'Outfield'
      team: player.teams?.name || 'Unknown',
      teamId: player.team_id,
      price: parseFloat(player.price),
      points: player.points_total || 0,
    })) || [];

    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Error fetching players:', error);
    return { data: null, error };
  }
};

/**
 * Fetch a single player by ID
 * @param {string} id - Player UUID
 * @returns {Promise<{data: Object, error: Error|null}>}
 */
export const fetchPlayerById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select(`
        *,
        teams (
          id,
          name,
          league
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Transform data
    const transformedData = {
      id: data.id,
      name: data.name,
      position: data.position,
      team: data.teams?.name || 'Unknown',
      teamId: data.team_id,
      price: parseFloat(data.price),
      points: data.points_total || 0,
    };

    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Error fetching player:', error);
    return { data: null, error };
  }
};

/**
 * Search players by name
 * @param {string} query - Search query
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const searchPlayers = async (query) => {
  try {
    if (!query || query.trim() === '') {
      return await fetchPlayers();
    }

    const { data, error } = await supabase
      .from('players')
      .select(`
        *,
        teams (
          id,
          name,
          league
        )
      `)
      .ilike('name', `%${query}%`)
      .order('name', { ascending: true });

    if (error) throw error;

    // Transform data
    const transformedData = data?.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.teams?.name || 'Unknown',
      teamId: player.team_id,
      price: parseFloat(player.price),
      points: player.points_total || 0,
    })) || [];

    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Error searching players:', error);
    return { data: null, error };
  }
};

/**
 * Filter players by position
 * @param {string} position - 'GK' or 'Outfield' or 'All'
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const filterPlayersByPosition = async (position) => {
  try {
    if (position === 'All') {
      return await fetchPlayers();
    }

    // Map UI labels to database values
    const dbPosition = position === 'Goalkeeper' ? 'GK' : 'Outfield';

    const { data, error } = await supabase
      .from('players')
      .select(`
        *,
        teams (
          id,
          name,
          league
        )
      `)
      .eq('position', dbPosition)
      .order('name', { ascending: true });

    if (error) throw error;

    // Transform data
    const transformedData = data?.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.teams?.name || 'Unknown',
      teamId: player.team_id,
      price: parseFloat(player.price),
      points: player.points_total || 0,
    })) || [];

    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Error filtering players:', error);
    return { data: null, error };
  }
};

/**
 * Combined search and filter
 * @param {string} query - Search query
 * @param {string} position - 'GK' or 'Outfield' or 'All'
 * @param {string} teamId - Team filter (team UUID or 'all')
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const searchAndFilterPlayers = async (query, position, teamId = null) => {
  try {
    let queryBuilder = supabase
      .from('players')
      .select(`
        *,
        teams (
          id,
          name,
          league
        )
      `);

    // Apply search filter if query exists
    if (query && query.trim() !== '') {
      queryBuilder = queryBuilder.ilike('name', `%${query}%`);
    }

    // Apply position filter if not 'All'
    if (position !== 'All') {
      const dbPosition = position === 'Goalkeeper' ? 'GK' : 'Outfield';
      queryBuilder = queryBuilder.eq('position', dbPosition);
    }

    // Apply team filter if selected
    if (teamId && teamId !== 'all') {
      queryBuilder = queryBuilder.eq('team_id', teamId);
    }

    const { data, error } = await queryBuilder.order('name', { ascending: true });

    if (error) throw error;

    // Transform data
    const transformedData = data?.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.teams?.name || 'Unknown',
      teamId: player.team_id,
      price: parseFloat(player.price),
      points: player.points_total || 0,
    })) || [];

    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Error searching and filtering players:', error);
    return { data: null, error };
  }
};
