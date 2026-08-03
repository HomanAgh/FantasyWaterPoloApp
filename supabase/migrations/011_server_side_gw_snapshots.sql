-- Migration: Server-Side GW Snapshot Fallback
-- Description: Adds a pg_cron-scheduled PostgreSQL function that creates
--              user_gw_picks snapshots for any finalized user who didn't have
--              the app open during a GW's active window (deadline → end_date).
--              Runs every 5 minutes; fully idempotent — ON CONFLICT DO NOTHING
--              means the first write (client-side from TeamContext) always wins
--              and is never overwritten.
--
-- Created: 2026-06-20
--
-- PREREQUISITE (one-time, do before running this migration):
--   Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable
--
-- HOW IT WORKS:
--   snapshot_missing_gw_picks() queries rounds whose deadline has passed AND
--   whose end_date is within the last 24 hours (i.e., rounds still in their
--   active window or just completed). This prevents retroactive backfilling
--   of rounds that users genuinely never participated in (late joiners).
--   For each finalized user (squad_finalized = true) that has zero rows in
--   user_gw_picks for that round, it copies their current user_teams into
--   user_gw_picks. ON CONFLICT DO NOTHING makes it safe to run on a tight
--   schedule — it becomes a no-op within seconds of the first successful save.
--
-- WHY THE 24-HOUR WINDOW:
--   Without it, a user who joins for GW3 would have their current team
--   retroactively inserted as GW1 and GW2 snapshots, earning points for
--   rounds they never participated in. The 24-hour window limits the function
--   to rounds that are currently active or just ended, matching the intent of
--   "catch users who missed the window" without awarding phantom past points.
--
-- WHY NOT AN EDGE FUNCTION:
--   This project manages the database entirely via the SQL editor with no local
--   Supabase CLI. A pure-SQL function + pg_cron matches that convention perfectly
--   and requires no deployment tooling or service-role secrets in app code.

-- =====================================================
-- 1. ENABLE pg_cron EXTENSION
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- 2. CREATE snapshot_missing_gw_picks() FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION snapshot_missing_gw_picks()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only target rounds that are in their active window OR ended within the
  -- last 24 hours. This prevents late joiners from receiving retroactive
  -- snapshots for rounds that completed long before they registered.
  --
  -- The NOT EXISTS subquery filters at the (user_id, round_id) level which
  -- is covered by idx_user_gw_picks_user_round, making it efficient even at
  -- large user counts. A user who already has picks (even just one) is skipped
  -- entirely — ON CONFLICT DO NOTHING handles any edge-case partial saves.
  INSERT INTO user_gw_picks (user_id, round_id, player_id, is_starter, is_captain)
  SELECT
    ut.user_id,
    r.id        AS round_id,
    ut.player_id,
    ut.is_starter,
    ut.is_captain
  FROM rounds r
  CROSS JOIN user_teams ut
  JOIN user_profiles up
    ON  up.user_id        = ut.user_id
    AND up.squad_finalized = true
  WHERE r.deadline <= NOW()
    AND r.end_date >= NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (
      SELECT 1
      FROM   user_gw_picks ugp
      WHERE  ugp.user_id  = ut.user_id
        AND  ugp.round_id = r.id
    )
  ON CONFLICT (user_id, round_id, player_id) DO NOTHING;
END;
$$;

-- =====================================================
-- 3. SCHEDULE WITH pg_cron (every 5 minutes)
-- =====================================================
-- Safely remove old schedule if this migration is re-run
DO $$
BEGIN
  PERFORM cron.unschedule('snapshot-missing-gw-picks');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'snapshot-missing-gw-picks',   -- job name
  '*/5 * * * *',                 -- every 5 minutes, all day, every day
  'SELECT snapshot_missing_gw_picks()'
);

-- =====================================================
-- 4. ONE-TIME BACKFILL
--    Affected user: 360e3ba0-2c51-4e2a-8099-7b038e0887cd
--    Missing round: GW2 (a4ab9020-e4e0-4ffd-a562-0c05d8ff4ed3)
--
--    Root cause: user never opened the app during GW2's 10-hour active
--    window (2026-06-19 12:00–22:00 UTC). When they did open the app,
--    fetchCurrentRound had already moved on to GW3 (upcoming), so
--    isLocked was false and no snapshot was triggered for GW2.
--    Their last_transfer_round_id was set to GW3 as a side-effect.
-- =====================================================
INSERT INTO user_gw_picks (user_id, round_id, player_id, is_starter, is_captain)
SELECT
  '360e3ba0-2c51-4e2a-8099-7b038e0887cd',
  'a4ab9020-e4e0-4ffd-a562-0c05d8ff4ed3',
  player_id,
  is_starter,
  is_captain
FROM user_teams
WHERE user_id = '360e3ba0-2c51-4e2a-8099-7b038e0887cd'
ON CONFLICT (user_id, round_id, player_id) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES (paste into SQL editor to check)
-- =====================================================

-- 1. Confirm the cron job was created:
-- SELECT jobid, jobname, schedule, command, active
-- FROM cron.job
-- WHERE jobname = 'snapshot-missing-gw-picks';

-- 2. Run the function manually (safe — idempotent):
-- SELECT snapshot_missing_gw_picks();

-- 3. Confirm the GW2 backfill worked for the affected user:
-- SELECT ugp.round_id, r.round_number, COUNT(*) AS player_count
-- FROM user_gw_picks ugp
-- JOIN rounds r ON r.id = ugp.round_id
-- WHERE ugp.user_id = '360e3ba0-2c51-4e2a-8099-7b038e0887cd'
-- GROUP BY ugp.round_id, r.round_number
-- ORDER BY r.round_number;
-- Expected: rows for round 1 (12 players) AND round 2 (12 players)

-- 4. Check the affected user's leaderboard entry updates:
-- SELECT * FROM global_leaderboard
-- WHERE user_id = '360e3ba0-2c51-4e2a-8099-7b038e0887cd';

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- SELECT cron.unschedule('snapshot-missing-gw-picks');
-- DROP FUNCTION IF EXISTS snapshot_missing_gw_picks();
-- -- To undo the backfill (remove the GW2 snapshot for the affected user):
-- DELETE FROM user_gw_picks
-- WHERE user_id  = '360e3ba0-2c51-4e2a-8099-7b038e0887cd'
--   AND round_id = 'a4ab9020-e4e0-4ffd-a562-0c05d8ff4ed3';
