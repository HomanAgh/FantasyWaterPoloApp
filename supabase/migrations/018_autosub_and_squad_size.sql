-- Migration: Squad auto-sub scoring + position_order on snapshots
-- Description:
--   1. Adds position_order to user_gw_picks (bench priority at snapshot time)
--   2. Updates server-side snapshot fallback to copy position_order
--   3. Adds score_user_round_with_autosub() for FPL-style auto-subs
--   4. Recreates global_leaderboard VIEW preserving the LIVE 7-column shape
--      (user_id, team_name, total_points, gameweeks_played,
--       last_points_update, user_since, rank)
--   5. Rewires get_user_global_rank / get_global_leaderboard /
--      get_league_leaderboard to use auto-sub scoring
--
-- IMPORTANT:
--   CREATE OR REPLACE VIEW cannot drop/rename columns. The production
--   global_leaderboard view has extra columns beyond migration 007, so this
--   script uses DROP VIEW ... CASCADE then recreates the view + dependents.
--
-- Auto-sub rules (match app):
--   - Blank starter (no appeared=true in round) may be replaced
--   - Same position only (GK↔GK, Outfield↔Outfield)
--   - Bench ordered by position_order ascending; each bench player used once
--   - Captain multiplier applies to the original captain starter slot
--   - No eligible sub → slot scores 0
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--
-- NOTE ON GOOGLE PLAY / OLD CLIENT:
--   Safe for the previous 12-player client. Schema is additive; RPCs keep the
--   same return shapes. Leaderboard totals may include auto-subs while the old
--   app's on-device GW math does not — not a crash, only a possible mismatch
--   until users update.
--
-- Created: 2026-10-02

-- =====================================================
-- 1. ADD position_order TO user_gw_picks
-- =====================================================
ALTER TABLE user_gw_picks
  ADD COLUMN IF NOT EXISTS position_order INTEGER;

-- =====================================================
-- 2. UPDATE snapshot_missing_gw_picks TO INCLUDE position_order
-- =====================================================
CREATE OR REPLACE FUNCTION snapshot_missing_gw_picks()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
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
    ON  up.user_id         = ut.user_id
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
-- 3. score_user_round_with_autosub(user_id, round_id)
-- =====================================================
CREATE OR REPLACE FUNCTION score_user_round_with_autosub(
  p_user_id  TEXT,
  p_round_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total   INTEGER := 0;
  r_starter RECORD;
  r_sub     RECORD;
  v_points  INTEGER;
  v_used    UUID[] := ARRAY[]::UUID[];
BEGIN
  FOR r_starter IN
    SELECT
      ugp.player_id,
      ugp.is_captain,
      ugp.position_order,
      p.position
    FROM user_gw_picks ugp
    JOIN players p ON p.id = ugp.player_id
    WHERE ugp.user_id = p_user_id
      AND ugp.round_id = p_round_id
      AND ugp.is_starter = true
    ORDER BY COALESCE(ugp.position_order, 99), ugp.player_id
  LOOP
    IF EXISTS (
      SELECT 1
      FROM player_match_stats pms
      JOIN fixtures f ON f.id = pms.fixture_id
      WHERE pms.player_id = r_starter.player_id
        AND f.round_id = p_round_id
        AND pms.appeared = true
    ) THEN
      SELECT COALESCE(
        (SELECT prp.points
         FROM player_round_points prp
         WHERE prp.player_id = r_starter.player_id
           AND prp.round_id  = p_round_id),
        0
      ) INTO v_points;
    ELSE
      v_points := 0;

      FOR r_sub IN
        SELECT
          ugp.player_id,
          ugp.position_order,
          p.position
        FROM user_gw_picks ugp
        JOIN players p ON p.id = ugp.player_id
        WHERE ugp.user_id = p_user_id
          AND ugp.round_id = p_round_id
          AND ugp.is_starter = false
          AND p.position = r_starter.position
          AND NOT (ugp.player_id = ANY (v_used))
        ORDER BY COALESCE(ugp.position_order, 99), ugp.player_id
      LOOP
        IF EXISTS (
          SELECT 1
          FROM player_match_stats pms
          JOIN fixtures f ON f.id = pms.fixture_id
          WHERE pms.player_id = r_sub.player_id
            AND f.round_id = p_round_id
            AND pms.appeared = true
        ) THEN
          SELECT COALESCE(
            (SELECT prp.points
             FROM player_round_points prp
             WHERE prp.player_id = r_sub.player_id
               AND prp.round_id  = p_round_id),
            0
          ) INTO v_points;
          v_used := array_append(v_used, r_sub.player_id);
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF r_starter.is_captain THEN
      v_points := COALESCE(v_points, 0) * 2;
    END IF;

    v_total := v_total + COALESCE(v_points, 0);
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION score_user_round_with_autosub(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION score_user_round_with_autosub(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION score_user_round_with_autosub(TEXT, UUID) TO anon;

-- =====================================================
-- 4. RECREATE global_leaderboard VIEW
--    DROP CASCADE is required because CREATE OR REPLACE cannot remove
--    columns, and production already has the 7-column shape.
--    get_user_global_rank is recreated in section 5.
-- =====================================================
DROP VIEW IF EXISTS global_leaderboard CASCADE;

CREATE VIEW global_leaderboard AS
WITH user_rounds AS (
  SELECT DISTINCT user_id, round_id
  FROM user_gw_picks
),
gw_scores AS (
  SELECT
    ur.user_id,
    ur.round_id,
    score_user_round_with_autosub(ur.user_id, ur.round_id)::bigint AS round_points
  FROM user_rounds ur
),
user_gw_totals AS (
  SELECT
    gs.user_id,
    COALESCE(SUM(gs.round_points), 0)::bigint AS gross_points,
    COUNT(DISTINCT gs.round_id)::bigint AS gameweeks_played
  FROM gw_scores gs
  GROUP BY gs.user_id
),
deduction_totals AS (
  SELECT
    user_id,
    COALESCE(SUM(deduction), 0)::bigint AS total_deduction
  FROM user_round_deductions
  GROUP BY user_id
),
last_updates AS (
  SELECT
    ugp.user_id,
    max(prp.updated_at) AS last_points_update
  FROM user_gw_picks ugp
  LEFT JOIN player_round_points prp
    ON prp.player_id = ugp.player_id
   AND prp.round_id  = ugp.round_id
  GROUP BY ugp.user_id
),
user_points AS (
  SELECT
    up.user_id,
    up.team_name,
    (COALESCE(ugt.gross_points, 0) - COALESCE(dt.total_deduction, 0))::bigint AS total_points,
    COALESCE(ugt.gameweeks_played, 0)::bigint AS gameweeks_played,
    lu.last_points_update,
    up.created_at AS user_since
  FROM user_profiles up
  LEFT JOIN user_gw_totals ugt ON ugt.user_id = up.user_id
  LEFT JOIN deduction_totals dt ON dt.user_id = up.user_id
  LEFT JOIN last_updates lu ON lu.user_id = up.user_id
)
SELECT
  user_id,
  team_name,
  total_points,
  gameweeks_played,
  last_points_update,
  user_since,
  row_number() OVER (ORDER BY total_points DESC, user_since) AS rank
FROM user_points
ORDER BY row_number() OVER (ORDER BY total_points DESC, user_since);

-- =====================================================
-- 5. RECREATE get_user_global_rank (dropped by CASCADE above)
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_global_rank(input_user_id TEXT)
RETURNS TABLE(rank BIGINT, total_points INTEGER, total_users BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH lb AS (
    SELECT
      gl.user_id,
      gl.total_points AS pts,
      gl.rank AS user_rank
    FROM global_leaderboard gl
  )
  SELECT
    (SELECT lb.user_rank FROM lb WHERE lb.user_id = input_user_id),
    (SELECT lb.pts::integer FROM lb WHERE lb.user_id = input_user_id),
    (SELECT COUNT(*)::bigint FROM lb);
END;
$$;

REVOKE ALL ON FUNCTION get_user_global_rank(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_global_rank(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_global_rank(TEXT) TO anon;

-- =====================================================
-- 6. RECREATE get_global_leaderboard (reads updated view)
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
  SELECT
    gl.user_id,
    gl.team_name,
    gl.total_points::integer,
    gl.rank,
    gl.gameweeks_played
  FROM global_leaderboard gl
  ORDER BY gl.rank
  LIMIT  limit_count
  OFFSET offset_count;
END;
$$;

-- =====================================================
-- 7. RECREATE get_league_leaderboard (auto-sub via view)
-- =====================================================
CREATE OR REPLACE FUNCTION get_league_leaderboard(
  input_league_id UUID,
  limit_count     INT DEFAULT 50,
  offset_count    INT DEFAULT 0
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
#variable_conflict use_column
DECLARE
  uid TEXT := auth.uid()::text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM league_members lm
    WHERE lm.league_id = input_league_id
      AND lm.user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this league';
  END IF;

  RETURN QUERY
  WITH member_rows AS (
    SELECT
      lm.user_id,
      COALESCE(up.team_name, 'Unknown Team') AS team_name,
      COALESCE(gl.total_points, 0)::integer AS total_points,
      COALESCE(gl.gameweeks_played, 0)::bigint AS gameweeks_played
    FROM league_members lm
    LEFT JOIN user_profiles up ON up.user_id = lm.user_id
    LEFT JOIN global_leaderboard gl ON gl.user_id = lm.user_id
    WHERE lm.league_id = input_league_id
  ),
  ranked AS (
    SELECT
      mr.user_id,
      mr.team_name,
      mr.total_points,
      mr.gameweeks_played,
      RANK() OVER (ORDER BY mr.total_points DESC) AS rank
    FROM member_rows mr
  )
  SELECT
    r.user_id,
    r.team_name,
    r.total_points,
    r.rank,
    r.gameweeks_played
  FROM ranked r
  ORDER BY r.rank, r.team_name
  LIMIT  limit_count
  OFFSET offset_count;
END;
$$;

REVOKE ALL ON FUNCTION get_league_leaderboard(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_league_leaderboard(UUID, INT, INT) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'user_gw_picks' AND column_name = 'position_order';
--
-- SELECT proname FROM pg_proc WHERE proname = 'score_user_round_with_autosub';
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'global_leaderboard' ORDER BY ordinal_position;
--
-- SELECT * FROM get_global_leaderboard(5, 0);
