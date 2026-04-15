import supabase from '../config/supabaseClient';

/**
 * Calculate final gameweek points with auto-substitution
 * This function processes all users after match stats are entered
 * 
 * @param {string} roundId - Round UUID
 * @returns {Promise<{success: boolean, processed: number, error: any}>}
 */
export const calculateRoundPointsWithAutoSub = async (roundId) => {
  try {
    // 1. Get all users with teams
    const { data: allUserTeams, error: teamsError } = await supabase
      .from('user_teams')
      .select('user_id');
    
    if (teamsError) throw teamsError;
    
    const userIds = [...new Set(allUserTeams.map(t => t.user_id))];
    let processedCount = 0;
    
    // 2. Process each user
    for (const userId of userIds) {
      await processUserAutoSubs(userId, roundId);
      processedCount++;
    }
    
    return { success: true, processed: processedCount, error: null };
  } catch (error) {
    console.error('Error calculating round points with auto-subs:', error);
    return { success: false, processed: 0, error };
  }
};

/**
 * Process auto-substitutions for a single user
 * @param {string} userId - User ID
 * @param {string} roundId - Round UUID
 * @returns {Promise<number>} Total points for the user
 */
const processUserAutoSubs = async (userId, roundId) => {
  try {
    // 1. Get user's team with position_order
    const { data: team, error: teamError } = await supabase
      .from('user_teams')
      .select(`
        player_id,
        is_starter,
        is_captain,
        position_order,
        players (
          id,
          position
        )
      `)
      .eq('user_id', userId)
      .order('position_order', { ascending: true });
    
    if (teamError) throw teamError;
    
    // 2. Get match stats for all players in this round
    const playerIds = team.map(t => t.player_id);
    const { data: matchStats, error: statsError } = await supabase
      .from('player_match_stats')
      .select(`
        player_id,
        appeared,
        points_earned,
        fixtures!inner (
          round_id
        )
      `)
      .in('player_id', playerIds)
      .eq('fixtures.round_id', roundId);
    
    if (statsError) throw statsError;
    
    // Create lookup map
    const statsMap = {};
    matchStats.forEach(stat => {
      statsMap[stat.player_id] = {
        appeared: stat.appeared,
        points: stat.points_earned
      };
    });
    
    // 3. Calculate points with auto-subs
    const starters = team.filter(t => t.is_starter);
    const bench = team.filter(t => !t.is_starter).sort((a, b) => a.position_order - b.position_order);
    
    let totalPoints = 0;
    const captainId = team.find(t => t.is_captain)?.player_id;
    
    for (const starter of starters) {
      const playerId = starter.player_id;
      const playerPosition = starter.players.position;
      const stats = statsMap[playerId];
      
      let pointsToUse = 0;
      let usedPlayerId = playerId; // Track which player's points we're using
      
      // Check if starter appeared
      if (stats && stats.appeared) {
        // Starter played - use their points
        pointsToUse = stats.points;
      } else {
        // Starter didn't play - find substitute
        const eligibleSubs = bench.filter(b => {
          const benchPosition = b.players.position;
          // GK can only replace GK, Outfield can replace Outfield
          return benchPosition === playerPosition && 
                 statsMap[b.player_id]?.appeared === true;
        });
        
        if (eligibleSubs.length > 0) {
          // Use first eligible sub (already sorted by position_order)
          const sub = eligibleSubs[0];
          pointsToUse = statsMap[sub.player_id].points;
          usedPlayerId = sub.player_id;
          console.log(`Auto-sub: ${playerId} (didn't play) replaced by ${sub.player_id}`);
        } else {
          // No eligible sub available
          pointsToUse = 0;
        }
      }
      
      // Apply captain bonus (always to the starter position, even if subbed)
      if (playerId === captainId) {
        pointsToUse *= 2;
      }
      
      totalPoints += pointsToUse;
      
      // 4. Save individual player round points for the STARTER
      await supabase
        .from('player_round_points')
        .upsert({
          player_id: playerId,
          round_id: roundId,
          points: pointsToUse,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'player_id,round_id'
        });
    }
    
    return totalPoints;
  } catch (error) {
    console.error('Error processing user auto-subs:', error);
    throw error;
  }
};

/**
 * Helper: Calculate position order for a player
 * Exported for use in TeamContext
 * @param {Object} player - Player object
 * @param {boolean} isStarter - Whether player is a starter
 * @param {Array} currentTeam - Current team array
 * @returns {number} Position order (1-12)
 */
export const calculatePositionOrder = (player, isStarter, currentTeam) => {
  if (isStarter) {
    const starters = currentTeam.filter(p => p.isStarter && p.id !== player.id);
    const gkStarters = starters.filter(p => p.position === 'GK').length;
    
    if (player.position === 'GK') {
      return 1;
    } else {
      return gkStarters + starters.filter(p => p.position === 'Outfield').length + 1;
    }
  } else {
    const bench = currentTeam.filter(p => !p.isStarter && p.id !== player.id);
    const gkBench = bench.filter(p => p.position === 'GK').length;
    
    if (player.position === 'GK') {
      return 8;
    } else {
      return 8 + gkBench + bench.filter(p => p.position === 'Outfield').length + 1;
    }
  }
};
