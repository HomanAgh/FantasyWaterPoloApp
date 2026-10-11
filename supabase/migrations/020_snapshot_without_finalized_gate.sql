-- Migration: Snapshot GW picks without requiring squad_finalized
-- Description:
--   Fixes the chicken-and-egg bug where snapshot_missing_gw_picks() only
--   copied user_teams for users with squad_finalized = true, while
--   finalization itself mostly happens client-side after the deadline.
--   Users who never opened the app after lock (especially their first GW)
--   got zero rows in user_gw_picks and disappeared from scoring.
--
--   This migration:
--   1. Snapshots ANY user with rows in user_teams for locked rounds in the
--      active window (deadline passed, end_date within last 24 hours)
--   2. Server-finalizes those users so transfer state stays consistent
--   3. Re-affirms the pg_cron schedule (idempotent)
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--
-- Created: 2026-10-09

-- =====================================================
-- 1. REPLACE snapshot_missing_gw_picks()
-- =====================================================
CREATE OR REPLACE FUNCTION snapshot_missing_gw_picks()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Copy live squads into user_gw_picks for any locked round still in (or
  -- just past) its active window. Do NOT require squad_finalized — that flag
  -- is often still false until the user opens the app after deadline.
  INSERT INTO user_gw_picks (
    user_id, round_id, player_id, is_starter, is_captain, position_order
  )
  SELECT
    ut.user_id,
    r.id        AS round_id,
    ut.player_id,
    ut.is_starter,
    ut.is_captain,
    ut.position_order
  FROM rounds r
  CROSS JOIN user_teams ut
  JOIN user_profiles up
    ON up.user_id = ut.user_id
  WHERE r.deadline <= NOW()
    AND r.end_date >= NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (
      SELECT 1
      FROM   user_gw_picks ugp
      WHERE  ugp.user_id  = ut.user_id
        AND  ugp.round_id = r.id
    )
  ON CONFLICT (user_id, round_id, player_id) DO NOTHING;

  -- Finalize users who had a team snapshotted for a locked round but never
  -- opened the app after the deadline. Leave already-finalized profiles alone.
  UPDATE user_profiles up
  SET
    squad_finalized          = true,
    last_transfer_round_id   = COALESCE(up.last_transfer_round_id, locked.id),
    free_transfers           = COALESCE(up.free_transfers, 1),
    transfers_made_this_round = COALESCE(up.transfers_made_this_round, 0)
  FROM (
    SELECT DISTINCT ON (ugp.user_id)
      ugp.user_id,
      r.id
    FROM user_gw_picks ugp
    JOIN rounds r ON r.id = ugp.round_id
    WHERE r.deadline <= NOW()
      AND r.end_date >= NOW() - INTERVAL '24 hours'
    ORDER BY ugp.user_id, r.deadline DESC
  ) AS locked
  WHERE up.user_id = locked.user_id
    AND up.squad_finalized = false
    AND EXISTS (
      SELECT 1 FROM user_teams ut WHERE ut.user_id = up.user_id
    );
END;
$$;

-- =====================================================
-- 2. ENSURE pg_cron JOB IS SCHEDULED
-- =====================================================
DO $$
BEGIN
  PERFORM cron.unschedule('snapshot-missing-gw-picks');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'snapshot-missing-gw-picks',
  '*/5 * * * *',
  'SELECT snapshot_missing_gw_picks()'
);

-- =====================================================
-- VERIFICATION (paste separately after running)
-- =====================================================
-- SELECT jobid, jobname, schedule, active
-- FROM cron.job
-- WHERE jobname = 'snapshot-missing-gw-picks';
--
-- SELECT snapshot_missing_gw_picks();
--
-- SELECT
--   (SELECT COUNT(DISTINCT user_id) FROM user_teams) AS users_with_teams,
--   (SELECT COUNT(DISTINCT user_id) FROM user_gw_picks) AS users_with_picks,
--   (SELECT COUNT(*) FROM user_profiles WHERE squad_finalized) AS finalized,
--   (SELECT COUNT(*) FROM user_profiles WHERE NOT squad_finalized
--      AND EXISTS (SELECT 1 FROM user_teams ut WHERE ut.user_id = user_profiles.user_id)
--   ) AS teams_still_unfinalized;

-- =====================================================
-- ROLLBACK
-- =====================================================
-- Revert to the 018 version (requires squad_finalized = true):
-- CREATE OR REPLACE FUNCTION snapshot_missing_gw_picks()
-- RETURNS void LANGUAGE plpgsql AS $$
-- BEGIN
--   INSERT INTO user_gw_picks (
--     user_id, round_id, player_id, is_starter, is_captain, position_order
--   )
--   SELECT ut.user_id, r.id, ut.player_id, ut.is_starter, ut.is_captain, ut.position_order
--   FROM rounds r
--   CROSS JOIN user_teams ut
--   JOIN user_profiles up ON up.user_id = ut.user_id AND up.squad_finalized = true
--   WHERE r.deadline <= NOW()
--     AND r.end_date >= NOW() - INTERVAL '24 hours'
--     AND NOT EXISTS (
--       SELECT 1 FROM user_gw_picks ugp
--       WHERE ugp.user_id = ut.user_id AND ugp.round_id = r.id
--     )
--   ON CONFLICT (user_id, round_id, player_id) DO NOTHING;
-- END;
-- $$;
