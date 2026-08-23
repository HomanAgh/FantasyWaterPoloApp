-- Migration: Leave / Kick private leagues + standings ambiguity fix
-- Description: Adds leave_league and kick_league_member RPCs. Also recreates
--              get_league_leaderboard and get_user_league_rank with
--              #variable_conflict use_column so RETURNS TABLE columns do not
--              clash with table columns (fixes "user_id is ambiguous").
-- Created: 2026-08-21
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--
-- BEHAVIOUR:
--   leave_league:
--     - Non-admin members can leave anytime.
--     - Admin cannot leave while other members remain.
--     - If admin is the last member, the league row is deleted (cascade).
--   kick_league_member:
--     - Only leagues.created_by may kick.
--     - Cannot kick yourself.
--
-- NOTE: Kicked users can rejoin with the same invite code. Regenerate-code
--       can be added later if needed.

-- =====================================================
-- 1. FIX get_league_leaderboard (ambiguous user_id)
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
    INNER JOIN league_members lm_scores
      ON lm_scores.user_id = ugp.user_id
     AND lm_scores.league_id = input_league_id
    LEFT JOIN player_round_points prp
      ON prp.player_id = ugp.player_id
     AND prp.round_id  = ugp.round_id
    GROUP BY ugp.user_id, ugp.round_id
  ),
  user_totals AS (
    SELECT
      gs.user_id,
      COALESCE(SUM(gs.round_points), 0)   AS gross_points,
      COUNT(DISTINCT gs.round_id)::BIGINT AS gw_count
    FROM gw_scores gs
    GROUP BY gs.user_id
  ),
  deduction_totals AS (
    SELECT
      urd.user_id,
      SUM(urd.deduction) AS total_deduction
    FROM user_round_deductions urd
    INNER JOIN league_members lm_d
      ON lm_d.user_id = urd.user_id
     AND lm_d.league_id = input_league_id
    GROUP BY urd.user_id
  ),
  ranked AS (
    SELECT
      lm.user_id,
      COALESCE(up.team_name, 'Unknown Team')                       AS team_name,
      (COALESCE(ut.gross_points, 0)
        - COALESCE(dt.total_deduction, 0))::INTEGER                AS total_points,
      COALESCE(ut.gw_count, 0)                                     AS gameweeks_played,
      RANK() OVER (
        ORDER BY (COALESCE(ut.gross_points, 0)
          - COALESCE(dt.total_deduction, 0)) DESC
      )                                                            AS rank
    FROM league_members lm
    LEFT JOIN user_totals ut      ON ut.user_id = lm.user_id
    LEFT JOIN deduction_totals dt ON dt.user_id = lm.user_id
    LEFT JOIN user_profiles up    ON up.user_id = lm.user_id
    WHERE lm.league_id = input_league_id
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
-- 2. FIX get_user_league_rank (ambiguous total_points)
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_league_rank(input_league_id UUID)
RETURNS TABLE(rank BIGINT, total_points INTEGER, total_members BIGINT)
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
  WITH lb AS (
    SELECT
      gl.user_id,
      gl.total_points,
      gl.rank AS user_rank
    FROM get_league_leaderboard(input_league_id, 10000, 0) gl
  )
  SELECT
    (SELECT lb.user_rank    FROM lb WHERE lb.user_id = uid),
    (SELECT lb.total_points FROM lb WHERE lb.user_id = uid),
    COUNT(*)::BIGINT AS total_members
  FROM lb;
END;
$$;

REVOKE ALL ON FUNCTION get_user_league_rank(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_league_rank(UUID) TO authenticated;

-- =====================================================
-- 3. leave_league(input_league_id)
-- =====================================================
CREATE OR REPLACE FUNCTION leave_league(input_league_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  uid          TEXT := auth.uid()::text;
  admin_id     TEXT;
  member_count BIGINT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT l.created_by INTO admin_id
  FROM leagues l
  WHERE l.id = input_league_id;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'League not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM league_members lm
    WHERE lm.league_id = input_league_id
      AND lm.user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this league';
  END IF;

  SELECT COUNT(*) INTO member_count
  FROM league_members lm
  WHERE lm.league_id = input_league_id;

  IF admin_id = uid THEN
    IF member_count > 1 THEN
      RAISE EXCEPTION 'Admin cannot leave while other members remain';
    END IF;
    -- Last member is the admin — delete the league (cascade removes membership)
    DELETE FROM leagues WHERE id = input_league_id;
    RETURN 'deleted';
  END IF;

  DELETE FROM league_members
  WHERE league_id = input_league_id
    AND user_id = uid;

  RETURN 'left';
END;
$$;

REVOKE ALL ON FUNCTION leave_league(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION leave_league(UUID) TO authenticated;

-- =====================================================
-- 4. kick_league_member(input_league_id, target_user_id)
-- =====================================================
CREATE OR REPLACE FUNCTION kick_league_member(
  input_league_id UUID,
  target_user_id  TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  uid      TEXT := auth.uid()::text;
  admin_id TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT l.created_by INTO admin_id
  FROM leagues l
  WHERE l.id = input_league_id;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'League not found';
  END IF;

  IF admin_id <> uid THEN
    RAISE EXCEPTION 'Only the league admin can kick members';
  END IF;

  IF target_user_id IS NULL OR target_user_id = uid THEN
    RAISE EXCEPTION 'Cannot kick yourself';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM league_members lm
    WHERE lm.league_id = input_league_id
      AND lm.user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this league';
  END IF;

  DELETE FROM league_members
  WHERE league_id = input_league_id
    AND user_id = target_user_id;

  RETURN 'kicked';
END;
$$;

REVOKE ALL ON FUNCTION kick_league_member(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kick_league_member(UUID, TEXT) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'leave_league', 'kick_league_member',
--     'get_league_leaderboard', 'get_user_league_rank'
--   );
-- Expected: all DEFINER
--
-- From the app (auth.uid() required):
--   SELECT leave_league('<league-uuid>');
--   SELECT kick_league_member('<league-uuid>', '<other-user-id>');

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP FUNCTION IF EXISTS leave_league(UUID);
-- DROP FUNCTION IF EXISTS kick_league_member(UUID, TEXT);
