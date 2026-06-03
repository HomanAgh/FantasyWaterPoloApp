import supabase from '../config/supabaseClient';

/**
 * Fetch all fixtures for a specific round with team names
 * @param {string} roundId - Round UUID
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const fetchFixturesForRound = async (roundId) => {
  try {
    const { data, error } = await supabase
      .from('fixtures')
      .select(`
        *,
        home_team:home_team_id (id, name),
        away_team:away_team_id (id, name)
      `)
      .eq('round_id', roundId)
      .order('match_date', { ascending: true });
    
    if (error) throw error;
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching fixtures for round:', error);
    return { data: [], error };
  }
};

/**
 * Fetch top performers from a specific fixture
 * @param {string} fixtureId - Fixture UUID
 * @param {number} limit - Number of top performers to return (default 3)
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const fetchTopPerformers = async (fixtureId, limit = 3) => {
  try {
    const { data, error } = await supabase
      .from('player_match_stats')
      .select(`
        *,
        player:player_id (id, name, team_id, position)
      `)
      .eq('fixture_id', fixtureId)
      .order('points_earned', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching top performers:', error);
    return { data: [], error };
  }
};

/**
 * Fetch fixtures across multiple recent rounds
 * @param {number} roundCount - Number of recent rounds to fetch (default 3)
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const fetchAllFixtures = async (roundCount = 3) => {
  try {
    // First, get the most recent rounds
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('id, round_number')
      .order('round_number', { ascending: false })
      .limit(roundCount);
    
    if (roundsError) throw roundsError;
    if (!rounds || rounds.length === 0) {
      return { data: [], error: null };
    }
    
    // Get round IDs
    const roundIds = rounds.map(r => r.id);
    
    // Fetch all fixtures for these rounds
    const { data, error } = await supabase
      .from('fixtures')
      .select(`
        *,
        home_team:home_team_id (id, name),
        away_team:away_team_id (id, name),
        round:round_id (id, round_number)
      `)
      .in('round_id', roundIds)
      .order('match_date', { ascending: false });
    
    if (error) throw error;
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching all fixtures:', error);
    return { data: [], error };
  }
};

/**
 * Get a specific fixture by ID
 * @param {string} fixtureId - Fixture UUID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const getFixtureById = async (fixtureId) => {
  try {
    const { data, error } = await supabase
      .from('fixtures')
      .select(`
        *,
        home_team:home_team_id (id, name),
        away_team:away_team_id (id, name),
        round:round_id (id, round_number)
      `)
      .eq('id', fixtureId)
      .single();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching fixture by ID:', error);
    return { data: null, error };
  }
};

/**
 * Format match date for display
 * @param {string} matchDate - ISO date string
 * @returns {string} - Formatted date/time string
 */
export const formatMatchDate = (matchDate) => {
  if (!matchDate) return '';
  
  const date = new Date(matchDate);
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get status badge styling info
 * @param {string} status - Fixture status ('scheduled', 'live', 'finished')
 * @returns {Object} - Style configuration with color and label
 */
export const getFixtureStatusStyle = (status) => {
  switch (status) {
    case 'finished':
      return {
        color: '#2ecc71',
        backgroundColor: '#d4edda',
        label: 'FINISHED',
        emoji: '✓',
      };
    case 'live':
      return {
        color: '#f39c12',
        backgroundColor: '#fff3cd',
        label: 'LIVE',
        emoji: '●',
      };
    case 'scheduled':
    default:
      return {
        color: '#3498db',
        backgroundColor: '#d1ecf1',
        label: 'SCHEDULED',
        emoji: '📅',
      };
  }
};

/**
 * Format player stats for display
 * @param {Object} stats - Player match stats object
 * @returns {string} - Formatted stats string (e.g., "2G, 1A")
 */
export const formatPlayerStats = (stats) => {
  if (!stats) return '';
  
  const parts = [];

  if (stats.goals > 0) parts.push(`${stats.goals}G`);
  if (stats.assists > 0) parts.push(`${stats.assists}A`);
  if (stats.saves > 0) parts.push(`${stats.saves} saves`);
  if (stats.blocks > 0) parts.push(`${stats.blocks} blk`);
  if (stats.sprints > 0) parts.push(`${stats.sprints} spr`);
  if (stats.clean_sheets > 0) parts.push(`${stats.clean_sheets} CS`);

  return parts.join(', ') || 'No stats';
};

/**
 * Update fixture status and scores (admin function)
 * @param {string} fixtureId - Fixture UUID
 * @param {Object} updates - Object with fields to update (status, home_score, away_score)
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const updateFixture = async (fixtureId, updates) => {
  try {
    const { data, error } = await supabase
      .from('fixtures')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fixtureId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error updating fixture:', error);
    return { data: null, error };
  }
};
