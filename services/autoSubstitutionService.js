import supabase from '../config/supabaseClient';

/**
 * Auto-substitution scoring helpers.
 *
 * Rules:
 * - Only blank starters (appeared !== true) are eligible for a sub
 * - GK can only be replaced by a GK bench player; Outfield by Outfield
 * - Bench priority is position_order ascending
 * - Each bench player may be used at most once
 * - Captain multiplier applies to the original captain's starter slot
 * - If no eligible sub exists, the slot scores 0
 *
 * This never writes to player_round_points — scoring is computed per-user.
 */

/**
 * Fetch appearance flags for players in a round.
 * A player "appeared" if any match-stat row for that round has appeared = true.
 *
 * @param {string[]} playerIds
 * @param {string} roundId
 * @returns {Promise<Record<string, boolean>>}
 */
export const fetchAppearanceMap = async (playerIds, roundId) => {
  const map = {};
  if (!playerIds?.length || !roundId) return map;

  playerIds.forEach(id => {
    map[id] = false;
  });

  try {
    const { data, error } = await supabase
      .from('player_match_stats')
      .select(`
        player_id,
        appeared,
        fixtures!inner (
          round_id
        )
      `)
      .in('player_id', playerIds)
      .eq('fixtures.round_id', roundId);

    if (error) throw error;

    (data || []).forEach(row => {
      if (row.appeared) {
        map[row.player_id] = true;
      }
    });
  } catch (error) {
    console.error('Error fetching appearance map:', error);
  }

  return map;
};

/**
 * Apply auto-subs to a squad snapshot / live team.
 *
 * @param {Array<{
 *   player_id: string,
 *   is_starter: boolean,
 *   is_captain: boolean,
 *   position_order?: number|null,
 *   position: string
 * }>} picks
 * @param {Record<string, boolean>} appearanceMap
 * @param {Record<string, number>} pointsMap - player_id → round points
 * @returns {{
 *   total: number,
 *   slots: Array<{
 *     starterId: string,
 *     usedPlayerId: string|null,
 *     points: number,
 *     rawPoints: number,
 *     wasAutoSub: boolean,
 *     isCaptain: boolean,
 *     position: string
 *   }>,
 *   usedBenchIds: Set<string>
 * }}
 */
export const resolveSquadPointsWithAutoSub = (picks, appearanceMap = {}, pointsMap = {}) => {
  const starters = (picks || [])
    .filter(p => p.is_starter)
    .sort((a, b) => (a.position_order ?? 99) - (b.position_order ?? 99));

  const bench = (picks || [])
    .filter(p => !p.is_starter)
    .sort((a, b) => (a.position_order ?? 99) - (b.position_order ?? 99));

  const usedBenchIds = new Set();
  const slots = [];
  let total = 0;

  for (const starter of starters) {
    const starterId = starter.player_id;
    const position = starter.position;
    const isCaptain = !!starter.is_captain;
    const starterAppeared = appearanceMap[starterId] === true;

    let usedPlayerId = starterId;
    let rawPoints = 0;
    let wasAutoSub = false;

    if (starterAppeared) {
      rawPoints = pointsMap[starterId] || 0;
    } else {
      const eligibleSub = bench.find(b => {
        if (usedBenchIds.has(b.player_id)) return false;
        if (b.position !== position) return false;
        return appearanceMap[b.player_id] === true;
      });

      if (eligibleSub) {
        usedPlayerId = eligibleSub.player_id;
        rawPoints = pointsMap[eligibleSub.player_id] || 0;
        wasAutoSub = true;
        usedBenchIds.add(eligibleSub.player_id);
      } else {
        usedPlayerId = null;
        rawPoints = 0;
      }
    }

    const points = isCaptain ? rawPoints * 2 : rawPoints;
    total += points;

    slots.push({
      starterId,
      usedPlayerId,
      points,
      rawPoints,
      wasAutoSub,
      isCaptain,
      position,
    });
  }

  return { total, slots, usedBenchIds };
};

/**
 * Build pick objects from live selectedPlayers (TeamContext shape).
 */
export const picksFromSelectedPlayers = (selectedPlayers, captainId) => {
  return (selectedPlayers || []).map(p => ({
    player_id: p.id,
    is_starter: !!p.isStarter,
    is_captain: p.id === captainId,
    position_order: p.positionOrder ?? null,
    position: p.position,
  }));
};

/**
 * Calculate position order for a player (1-7 starters, 8-9 bench with 1+1).
 * Exported for TeamContext / tests.
 */
export const calculatePositionOrder = (player, isStarter, currentTeam) => {
  if (isStarter) {
    const starters = currentTeam.filter(p => p.isStarter && p.id !== player.id);
    const gkStarters = starters.filter(p => p.position === 'GK').length;

    if (player.position === 'GK') {
      return 1;
    }
    return gkStarters + starters.filter(p => p.position === 'Outfield').length + 1;
  }

  const bench = currentTeam.filter(p => !p.isStarter && p.id !== player.id);
  const gkBench = bench.filter(p => p.position === 'GK').length;

  if (player.position === 'GK') {
    return 8;
  }
  // Single outfield sub sits at 9 (after bench GK if present)
  return 8 + gkBench + bench.filter(p => p.position === 'Outfield').length + 1;
};
