import supabase from '../config/supabaseClient';

/**
 * Fetch the current active or next upcoming round.
 * Priority order:
 *   1. Active round: deadline passed, end_date not yet passed
 *   2. Next upcoming round: deadline still in the future
 *   3. Most recently completed round: both deadline and end_date in the past
 *      (prevents orphaned rounds from disappearing when end_date passes)
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const fetchCurrentRound = async () => {
  try {
    const now = new Date().toISOString();
    
    // 1. Active round: deadline passed but end_date not yet passed
    let { data, error } = await supabase
      .from('rounds')
      .select('*')
      .lte('deadline', now)
      .gte('end_date', now)
      .order('round_number', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;

    // 2. No active round — get next upcoming (deadline in the future)
    if (!data) {
      ({ data, error } = await supabase
        .from('rounds')
        .select('*')
        .gt('deadline', now)
        .order('round_number', { ascending: true })
        .limit(1)
        .maybeSingle());

      if (error) throw error;
    }

    // 3. No upcoming round either — fall back to the most recently completed round
    //    so the app never loses track of the last played GW
    if (!data) {
      ({ data, error } = await supabase
        .from('rounds')
        .select('*')
        .lt('end_date', now)
        .order('round_number', { ascending: false })
        .limit(1)
        .maybeSingle());

      if (error) throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching current round:', error);
    return { data: null, error };
  }
};

/**
 * Fetch all rounds ordered by round number
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const fetchAllRounds = async () => {
  try {
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('round_number', { ascending: true });
    
    if (error) throw error;
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching all rounds:', error);
    return { data: [], error };
  }
};

/**
 * Get a specific round by ID
 * @param {string} roundId - Round UUID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const getRoundById = async (roundId) => {
  try {
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', roundId)
      .single();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching round by ID:', error);
    return { data: null, error };
  }
};

/**
 * Check if a round is locked (deadline has passed)
 * @param {Object} round - Round object with deadline property
 * @returns {boolean}
 */
export const isRoundLocked = (round) => {
  if (!round || !round.deadline) return false;
  
  const now = new Date();
  const deadline = new Date(round.deadline);
  
  return now >= deadline;
};

/**
 * Calculate the status of a round based on current time
 * @param {Object} round - Round object with start_date, end_date, and deadline
 * @returns {string} - 'upcoming', 'active', or 'completed'
 */
export const getRoundStatus = (round) => {
  if (!round) return 'upcoming';
  
  const now = new Date();
  const deadline = new Date(round.deadline);
  const endDate = new Date(round.end_date);
  
  if (now < deadline) {
    return 'upcoming';
  } else if (now >= deadline && now <= endDate) {
    return 'active';
  } else {
    return 'completed';
  }
};

/**
 * Get time remaining until deadline in a human-readable format
 * @param {Object} round - Round object with deadline property
 * @returns {Object|null} - Object with days, hours, minutes or null if deadline passed
 */
export const getTimeToDeadline = (round) => {
  if (!round || !round.deadline) return null;
  
  const now = new Date();
  const deadline = new Date(round.deadline);
  const diff = deadline - now;
  
  if (diff <= 0) return null; // Deadline passed
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  // Return an object instead of a string
  return { days, hours, minutes };
};

/**
 * Format deadline for display
 * @param {string} deadline - ISO date string
 * @returns {string} - Formatted date/time string
 */
export const formatDeadline = (deadline) => {
  if (!deadline) return '';
  
  const date = new Date(deadline);
  const now = new Date();
  const diff = date - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  // If more than 24 hours away, show date
  if (hours > 24) {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // If less than 24 hours, show countdown
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return 'Deadline passed';
  }
};

/**
 * Update round status (admin function)
 * @param {string} roundId - Round UUID
 * @param {string} status - New status ('upcoming', 'active', 'completed')
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const updateRoundStatus = async (roundId, status) => {
  try {
    const { data, error } = await supabase
      .from('rounds')
      .update({ status })
      .eq('id', roundId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error updating round status:', error);
    return { data: null, error };
  }
};
