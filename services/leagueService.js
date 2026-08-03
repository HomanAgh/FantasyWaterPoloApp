import supabase from '../config/supabaseClient';

/**
 * Fetch global leaderboard with rankings
 * @param {number} limit - Number of entries to return (default: 50)
 * @param {number} offset - Offset for pagination (default: 0)
 * @returns {Promise<{data, error}>}
 */
export async function fetchGlobalLeaderboard(limit = 50, offset = 0) {
  try {
    const { data, error } = await supabase
      .rpc('get_global_leaderboard', { limit_count: limit, offset_count: offset });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching global leaderboard:', error);
    return { data: null, error };
  }
}

/**
 * Get current user's rank in global leaderboard
 * Uses the database function for efficient lookup
 * @param {string} userId
 * @returns {Promise<{rank, totalPoints, totalUsers, error}>}
 */
export async function getUserGlobalRank(userId) {
  try {
    const { data, error } = await supabase
      .rpc('get_user_global_rank', { input_user_id: userId });

    if (error) throw error;

    // RPC returns array, get first result
    const result = data?.[0] || { rank: null, total_points: 0, total_users: 0 };

    return {
      rank: result.rank,
      totalPoints: result.total_points,
      totalUsers: result.total_users,
      error: null,
    };
  } catch (error) {
    console.error('Error fetching user rank:', error);
    return { rank: null, totalPoints: 0, totalUsers: 0, error };
  }
}

/**
 * Get leaderboard entries around a specific user (context view)
 * Shows users above and below the target user
 * @param {string} userId
 * @param {number} context - Number of users to show above and below (default: 2)
 * @returns {Promise<{data, error}>}
 */
export async function getLeaderboardAroundUser(userId, context = 2) {
  try {
    // First get user's rank
    const { rank, error: rankError } = await getUserGlobalRank(userId);

    if (rankError || !rank) {
      return { data: null, error: rankError };
    }

    // Fetch a window of entries centred around the user's rank
    const startOffset = Math.max(0, rank - context - 1);
    const fetchCount = context * 2 + 1;

    const { data, error } = await supabase
      .rpc('get_global_leaderboard', { limit_count: fetchCount, offset_count: startOffset });

    if (error) throw error;

    // Trim to the exact rank window in case the offset lands slightly off
    const rangeStart = Math.max(1, rank - context);
    const rangeEnd = rank + context;
    const filtered = (data || []).filter(e => e.rank >= rangeStart && e.rank <= rangeEnd);

    return { data: filtered, error: null };
  } catch (error) {
    console.error('Error fetching leaderboard around user:', error);
    return { data: null, error };
  }
}
