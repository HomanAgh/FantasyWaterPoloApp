-- Migration: Leaderboard SECURITY DEFINER Functions
-- Description: Replaces direct queries to the global_leaderboard VIEW with
--              SECURITY DEFINER RPC functions so the leaderboard reads all
--              users' data regardless of RLS policies on user_gw_picks and
--              user_round_deductions. Also removes the temporary quick-fix
--              public SELECT policies that were added as a stop-gap.
-- Created: 2026-06-21
--
-- BACKGROUND:
--   The global_leaderboard VIEW computes scores by reading user_gw_picks and
--   user_round_deductions. Both tables have RLS policies that restrict SELECT
--   to the row owner (auth.uid()::text = user_id). When a client queries the
--   view, PostgreSQL applies those policies against the calling user's JWT,
--   so every other user's rows are invisible — resulting in 0 points for
--   everyone except the current user.
--
--   SECURITY DEFINER functions run as their owner (the postgres superuser),
--   which bypasses RLS entirely. This is the correct pattern for leaderboards
--   that legitimately need cross-user read access without exposing raw rows.
--
--   The global_leaderboard VIEW is kept as-is — it remains a useful debugging
--   tool in the Supabase SQL editor where queries run as superuser anyway.

-- =====================================================
-- 1. REMOVE TEMPORARY QUICK-FIX POLICIES
--    These were added as an emergency stop-gap. Now that proper SECURITY
--    DEFINER functions exist, the underlying tables can stay locked down.
-- =====================================================
DROP POLICY IF EXISTS "Public read on user_gw_picks" ON user_gw_picks;
DROP POLICY IF EXISTS "Public read on user_round_deductions" ON user_round_deductions;
DROP POLICY IF EXISTS "Public read on user_teams" ON user_teams;

-- =====================================================
-- 2. CREATE get_global_leaderboard() — SECURITY DEFINER
--    Returns ranked leaderboard entries for all users.
--    Called by LeaguesScreen via fetchGlobalLeaderboard().
--
--    Columns returned:
--      user_id          TEXT
--      team_name        TEXT
--      total_points     INTEGER  (gross points minus transfer deductions)
--      rank             BIGINT
--      gameweeks_played BIGINT   (distinct GWs with at least one pick)
-- =====================================================
CREATE OR REPLACE FUNCTION get_global_leaderboard(
  limit_count  INT DEFAULT 50,
  offset_count INT DEFAULT 0
)
RETURNS TABLE(
  user_id          TEXT,
  team_name        TEXT,
  total_points     INTEGER,
  rank             BIGINT,
  gameweeks_played BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH gw_scores AS (
    SELECT
      ugp.user_id,
      ugp.round_id,
      SUM(
        CASE WHEN ugp.is_starter
          THEN COALESCE(prp.points, 0) * (CASE WHEN ugp.is_captain THEN 2 ELSE 1 END)
          ELSE 0
        END
      ) AS round_points
    FROM user_gw_picks ugp
    LEFT JOIN player_round_points prp
      ON prp.player_id = ugp.player_id
     AND prp.round_id  = ugp.round_id
    GROUP BY ugp.user_id, ugp.round_id
  ),
  user_totals AS (
    SELECT
      gs.user_id,
      COALESCE(SUM(gs.round_points), 0)    AS gross_points,
      COUNT(DISTINCT gs.round_id)::BIGINT  AS gw_count
    FROM gw_scores gs
    GROUP BY gs.user_id
  ),
  deduction_totals AS (
    SELECT
      user_id,
      SUM(deduction) AS total_deduction
    FROM user_round_deductions
    GROUP BY user_id
  ),
  ranked AS (
    SELECT
      ut.user_id,
      COALESCE(up.team_name, 'Unknown Team')                              AS team_name,
      (ut.gross_points - COALESCE(dt.total_deduction, 0))::INTEGER        AS total_points,
      ut.gw_count                                                         AS gameweeks_played,
      RANK() OVER (
        ORDER BY (ut.gross_points - COALESCE(dt.total_deduction, 0)) DESC
      )                                                                   AS rank
    FROM user_totals ut
    LEFT JOIN deduction_totals dt ON dt.user_id = ut.user_id
    LEFT JOIN user_profiles    up ON up.user_id = ut.user_id
  )
  SELECT
    r.user_id,
    r.team_name,
    r.total_points,
    r.rank,
    r.gameweeks_played
  FROM ranked r
  ORDER BY r.rank
  LIMIT  limit_count
  OFFSET offset_count;
END;
$$;

-- =====================================================
-- 3. RECREATE get_user_global_rank() — SECURITY DEFINER
--    Adds SECURITY DEFINER to the existing function so it can read
--    the global_leaderboard view (which in turn reads user_gw_picks
--    and user_round_deductions) without being blocked by RLS.
--    Called by TeamContext (lockedTotalPoints) and LeaguesScreen (your rank).
--    Signature is unchanged — no app code updates needed for this function.
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_global_rank(input_user_id TEXT)
RETURNS TABLE(rank BIGINT, total_points INTEGER, total_users BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH lb AS (
    SELECT
      gl.user_id,
      gl.total_points,
      gl.rank AS user_rank
    FROM global_leaderboard gl
  )
  SELECT
    (SELECT user_rank   FROM lb WHERE lb.user_id = input_user_id),
    (SELECT total_points FROM lb WHERE lb.user_id = input_user_id),
    COUNT(*)::BIGINT AS total_users
  FROM lb;
END;
$$;

-- =====================================================
-- VERIFICATION QUERIES (paste into SQL editor to check)
-- =====================================================

-- 1. Confirm both functions are SECURITY DEFINER:
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('get_global_leaderboard', 'get_user_global_rank');
-- Expected: security_type = 'DEFINER' for both

-- 2. Full leaderboard (first 10):
-- SELECT * FROM get_global_leaderboard(10, 0);

-- 3. Specific user rank:
-- SELECT * FROM get_user_global_rank('<your-user-id>');

-- 4. Confirm temp policies are gone:
-- SELECT tablename, policyname
-- FROM pg_policies
-- WHERE policyname IN (
--   'Public read on user_gw_picks',
--   'Public read on user_round_deductions',
--   'Public read on user_teams'
-- );
-- Expected: 0 rows

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- DROP FUNCTION IF EXISTS get_global_leaderboard(INT, INT);
-- -- Restore get_user_global_rank WITHOUT security definer (reverts to migration 007):
-- CREATE OR REPLACE FUNCTION get_user_global_rank(input_user_id TEXT)
-- RETURNS TABLE(rank BIGINT, total_points INTEGER, total_users BIGINT)
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   RETURN QUERY
--   WITH lb AS (
--     SELECT gl.user_id, gl.total_points, gl.rank AS user_rank
--     FROM global_leaderboard gl
--   )
--   SELECT
--     (SELECT user_rank    FROM lb WHERE lb.user_id = input_user_id),
--     (SELECT total_points FROM lb WHERE lb.user_id = input_user_id),
--     COUNT(*)::BIGINT AS total_users
--   FROM lb;
-- END;
-- $$;
