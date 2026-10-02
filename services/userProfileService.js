import supabase from '../config/supabaseClient';

/**
 * Get user profile by user_id
 * @param {string} userId - User ID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { data: null, error };
  }
};

/**
 * Create a new user profile
 * @param {string} userId - User ID
 * @param {string} teamName - Team name
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const createUserProfile = async (userId, teamName) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert([
        {
          user_id: userId,
          team_name: teamName,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating user profile:', error);
    return { data: null, error };
  }
};

/**
 * Update team name for a user
 * @param {string} userId - User ID
 * @param {string} teamName - New team name
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const updateTeamName = async (userId, teamName) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ team_name: teamName })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating team name:', error);
    return { data: null, error };
  }
};

/**
 * Check if a user profile exists.
 * Returns `{ data: boolean, error }` — never treats API failure as "no profile".
 * @param {string} userId - User ID
 * @returns {Promise<{data: boolean|null, error: Error|null}>}
 */
export const checkIfProfileExists = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[checkIfProfileExists] Supabase error:', error.message || error);
      return { data: null, error };
    }

    return { data: data !== null, error: null };
  } catch (error) {
    console.warn('[checkIfProfileExists] Error checking profile existence:', error);
    return { data: null, error };
  }
};

/**
 * Report another user's team name as offensive.
 * Creates an open row in team_name_reports for manual admin review.
 * @param {string} reportedUserId
 * @returns {Promise<{data: 'reported'|null, error: Error|null}>}
 */
export const reportTeamName = async (reportedUserId) => {
  try {
    const { data, error } = await supabase
      .rpc('report_team_name', { target_user_id: reportedUserId });

    if (error) throw error;
    return { data: data || null, error: null };
  } catch (error) {
    console.error('Error reporting team name:', error);
    return { data: null, error };
  }
};
