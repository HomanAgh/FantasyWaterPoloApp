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
 * Fetch full detail stats for a single player:
 * - Aggregated season stats from player_match_stats
 * - GW points history from player_round_points
 * - Last 5 match performances joined with fixture/team info
 * @param {string} playerId - Player UUID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const fetchPlayerDetail = async (playerId) => {
  try {
    // 1. Base player info
    const { data: playerRow, error: playerError } = await supabase
      .from('players')
      .select(`*, teams (id, name, league)`)
      .eq('id', playerId)
      .single();

    if (playerError) throw playerError;

    // 2. Aggregate season stats from player_match_stats (migration 005 required)
    const { data: matchStats, error: statsError } = await supabase
      .from('player_match_stats')
      .select(`
        goals, assists, saves, minutes_played, points_earned,
        yellow_cards, red_cards, clean_sheets, blocks, sprints,
        fixtures (
          id, match_date, status, home_score, away_score,
          home_team:home_team_id (id, name),
          away_team:away_team_id (id, name),
          round:round_id (round_number)
        )
      `)
      .eq('player_id', playerId)
      .order('fixtures(match_date)', { ascending: false });

    if (statsError) throw statsError;

    const stats = matchStats || [];
    const gamesPlayed = stats.length;
    const totalGoals = stats.reduce((s, r) => s + (r.goals || 0), 0);
    const totalAssists = stats.reduce((s, r) => s + (r.assists || 0), 0);
    const totalSaves = stats.reduce((s, r) => s + (r.saves || 0), 0);
    const totalMinutes = stats.reduce((s, r) => s + (r.minutes_played || 0), 0);
    const totalYellows = stats.reduce((s, r) => s + (r.yellow_cards || 0), 0);
    const totalReds = stats.reduce((s, r) => s + (r.red_cards || 0), 0);
    const totalCleanSheets = stats.reduce((s, r) => s + (r.clean_sheets || 0), 0);
    const totalBlocks = stats.reduce((s, r) => s + (r.blocks || 0), 0);
    const totalSprints = stats.reduce((s, r) => s + (r.sprints || 0), 0);
    const pointsPerGame = gamesPlayed > 0
      ? (playerRow.points_total / gamesPlayed).toFixed(1)
      : '0.0';

    // Last 5 matches for the match log
    const recentMatches = stats.slice(0, 5).map(r => ({
      goals: r.goals,
      assists: r.assists,
      saves: r.saves,
      minutesPlayed: r.minutes_played,
      yellowCards: r.yellow_cards || 0,
      redCards: r.red_cards || 0,
      cleanSheets: r.clean_sheets || 0,
      blocks: r.blocks || 0,
      sprints: r.sprints || 0,
      pointsEarned: r.points_earned,
      fixture: r.fixtures,
    }));

    // 3. GW points history for the form strip
    const { data: roundPoints, error: rpError } = await supabase
      .from('player_round_points')
      .select(`points, rounds (round_number)`)
      .eq('player_id', playerId)
      .order('rounds(round_number)', { ascending: false })
      .limit(6);

    if (rpError) throw rpError;

    const formHistory = (roundPoints || []).reverse().map(r => ({
      roundNumber: r.rounds?.round_number,
      points: r.points,
    }));

    return {
      data: {
        id: playerRow.id,
        name: playerRow.name,
        position: playerRow.position,
        team: playerRow.teams?.name || 'Unknown',
        teamId: playerRow.team_id,
        price: parseFloat(playerRow.price),
        totalPoints: playerRow.points_total || 0,
        gamesPlayed,
        totalGoals,
        totalAssists,
        totalSaves,
        totalMinutes,
        totalYellows,
        totalReds,
        totalCleanSheets,
        totalBlocks,
        totalSprints,
        pointsPerGame,
        recentMatches,
        formHistory,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching player detail:', error);
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

/**
 * Search and filter players with aggregated season stats.
 * Reads from the player_season_stats view (migration 010).
 * Returns the same shape as searchAndFilterPlayers plus individual stat totals.
 * @param {string} query
 * @param {string} position - 'All' | 'Goalkeeper' | 'Field Player'
 * @param {string} teamId   - team UUID or 'all'
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const searchAndFilterPlayersWithStats = async (query, position, teamId = null) => {
  try {
    let q = supabase.from('player_season_stats').select('*');

    if (query && query.trim() !== '') {
      q = q.ilike('name', `%${query}%`);
    }

    if (position !== 'All') {
      q = q.eq('position', position === 'Goalkeeper' ? 'GK' : 'Outfield');
    }

    if (teamId && teamId !== 'all') {
      q = q.eq('team_id', teamId);
    }

    const { data, error } = await q.order('name', { ascending: true });
    if (error) throw error;

    const transformed = (data || []).map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      team: p.team_name || 'Unknown',
      teamId: p.team_id,
      price: parseFloat(p.price),
      points: p.points_total || 0,
      gamesPlayed: Number(p.games_played) || 0,
      goals: Number(p.total_goals) || 0,
      assists: Number(p.total_assists) || 0,
      saves: Number(p.total_saves) || 0,
      penaltySaves: Number(p.total_penalty_saves) || 0,
      blocks: Number(p.total_blocks) || 0,
      sprints: Number(p.total_sprints) || 0,
      cleanSheets: Number(p.total_clean_sheets) || 0,
      yellows: Number(p.total_yellows) || 0,
      reds: Number(p.total_reds) || 0,
    }));

    return { data: transformed, error: null };
  } catch (error) {
    console.error('Error fetching players with stats:', error);
    return { data: null, error };
  }
};
