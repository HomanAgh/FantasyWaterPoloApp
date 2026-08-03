import supabase from '../config/supabaseClient';

const MAX_FREE_TRANSFERS = 2;
const POINT_COST_PER_EXTRA_TRANSFER = 4;

/**
 * Fetch the current transfer state for a user from user_profiles.
 */
export const getTransferState = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        'free_transfers, last_transfer_round_id, transfers_made_this_round, squad_finalized, pending_deductions'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    return {
      data: {
        freeTransfers: data?.free_transfers ?? 1,
        lastTransferRoundId: data?.last_transfer_round_id ?? null,
        transfersMadeThisRound: data?.transfers_made_this_round ?? 0,
        squadFinalized: data?.squad_finalized ?? false,
        pendingDeductions: data?.pending_deductions ?? 0,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching transfer state:', error);
    return { data: null, error };
  }
};

/**
 * Award +1 free transfer (capped at MAX_FREE_TRANSFERS) when a new gameweek starts.
 * Resets transfers_made_this_round and pending_deductions for the new GW.
 * Reads current free_transfers from DB directly to avoid stale-closure issues.
 */
export const processRoundRollover = async (userId, currentRoundId) => {
  try {
    const { data: currentState, error: readError } = await getTransferState(userId);
    if (readError) throw readError;

    const currentFreeTransfers = currentState?.freeTransfers ?? 1;
    const newFreeTransfers = Math.min(currentFreeTransfers + 1, MAX_FREE_TRANSFERS);

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        free_transfers: newFreeTransfers,
        last_transfer_round_id: currentRoundId,
        transfers_made_this_round: 0,
        pending_deductions: 0,
      })
      .eq('user_id', userId)
      .select('free_transfers, transfers_made_this_round, pending_deductions')
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error processing round rollover:', error);
    return { data: null, error };
  }
};

/**
 * Record one player swap as a transfer.
 * Uses a free transfer if available, otherwise deducts 4 points.
 *
 * For paid transfers the deduction is written to two places:
 *   1. user_profiles.pending_deductions  — live display during the current GW
 *   2. user_round_deductions             — permanent record used by the leaderboard
 *      The leaderboard view subtracts all rows in user_round_deductions so the
 *      total is always accurate even after pending_deductions resets next GW.
 */
export const recordTransfer = async (
  userId,
  currentFreeTransfers,
  currentDeductions,
  currentTransfersMade,
  roundId
) => {
  try {
    const usesFreeTransfer = currentFreeTransfers > 0;
    const newFreeTransfers = usesFreeTransfer ? currentFreeTransfers - 1 : currentFreeTransfers;
    const newDeductions = usesFreeTransfer
      ? currentDeductions
      : currentDeductions + POINT_COST_PER_EXTRA_TRANSFER;

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        free_transfers: newFreeTransfers,
        pending_deductions: newDeductions,
        transfers_made_this_round: currentTransfersMade + 1,
      })
      .eq('user_id', userId)
      .select('free_transfers, pending_deductions, transfers_made_this_round')
      .single();

    if (error) throw error;

    // Permanently record paid transfer deductions so the leaderboard stays
    // accurate across round rollovers (pending_deductions resets each GW).
    if (!usesFreeTransfer && roundId) {
      await supabase
        .from('user_round_deductions')
        .upsert(
          {
            user_id: userId,
            round_id: roundId,
            deduction: newDeductions,
          },
          { onConflict: 'user_id,round_id' }
        );
    }

    return {
      data,
      error: null,
      usesFreeTransfer,
      pointCost: usesFreeTransfer ? 0 : POINT_COST_PER_EXTRA_TRANSFER,
    };
  } catch (error) {
    console.error('Error recording transfer:', error);
    return { data: null, error };
  }
};

/**
 * Mark the squad as finalized after GW1 deadline passes.
 * Initialises free_transfers = 1 and anchors last_transfer_round_id to GW1.
 */
export const finalizeSquad = async (userId, currentRoundId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        squad_finalized: true,
        last_transfer_round_id: currentRoundId,
        free_transfers: 1,
        transfers_made_this_round: 0,
        pending_deductions: 0,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error finalizing squad:', error);
    return { data: null, error };
  }
};
