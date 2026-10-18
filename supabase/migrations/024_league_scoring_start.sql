-- Migration: Private league scoring start round
-- Description: Lets a private league count points from a chosen round onward
--              (fresh start). NULL scoring_start_round_id keeps full-season
--              totals (existing behaviour). create_league can resolve the next
--              upcoming round when start_from_next_round is true.
-- Created: 2026-10-17
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--
-- BEHAVIOUR:
--   - Existing leagues: scoring_start_round_id stays NULL → all rounds count.
--   - New league with start_from_next_round=true: stores the earliest round
--     whose deadline is still in the future. Standings ignore earlier GWs
--     (and deductions). Late joiners still bring points from that start GW on
--     (league window scoring, not join-date scoring).
--   - get_league_leaderboard recomputes with autosub (same as global) so the
--     start filter cannot piggy-back on the full-season global_leaderboard view.

-- =====================================================
-- 1. COLUMN
-- =====================================================
ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS scoring_start_round_id UUID
    REFERENCES rounds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leagues_scoring_start
  ON leagues(scoring_start_round_id);

-- =====================================================
-- 2. create_league(league_name, start_from_next_round)
--    Drop old single-arg overload so callers use the new signature.
-- =====================================================
DROP FUNCTION IF EXISTS create_league(TEXT);

CREATE OR REPLACE FUNCTION create_league(
  league_name           TEXT,
  start_from_next_round BOOLEAN DEFAULT false
)
RETURNS TABLE(
  id                          UUID,
  name                        TEXT,
  invite_code                 TEXT,
  scoring_start_round_id      UUID,
  scoring_start_round_number  INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid          TEXT := auth.uid()::text;
  trimmed      TEXT;
  new_id       UUID;
  new_code     TEXT;
  start_id     UUID;
  start_number INT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  trimmed := btrim(league_name);

  IF length(trimmed) < 3 OR length(trimmed) > 30 THEN
    RAISE EXCEPTION 'League name must be between 3 and 30 characters';
  END IF;

  IF trimmed !~ '^[a-zA-Z0-9[:space:]\-_''!]+$' THEN
    RAISE EXCEPTION 'League name contains invalid characters';
  END IF;

  start_id := NULL;
  start_number := NULL;

  IF COALESCE(start_from_next_round, false) THEN
    SELECT r.id, r.round_number
      INTO start_id, start_number
    FROM rounds r
    WHERE r.deadline > NOW()
    ORDER BY r.round_number ASC
    LIMIT 1;

    IF start_id IS NULL THEN
      RAISE EXCEPTION 'No upcoming round available to start scoring from';
    END IF;
  END IF;

  new_code := generate_league_invite_code();

  INSERT INTO leagues (name, invite_code, created_by, scoring_start_round_id)
  VALUES (trimmed, new_code, uid, start_id)
  RETURNING leagues.id INTO new_id;

  INSERT INTO league_members (league_id, user_id)
  VALUES (new_id, uid);

  RETURN QUERY
  SELECT new_id, trimmed, new_code, start_id, start_number;
END;
$$;

REVOKE ALL ON FUNCTION create_league(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_league(TEXT, BOOLEAN) TO authenticated;

-- =====================================================
-- 3. get_my_leagues() — include scoring start for UI badge
-- =====================================================
DROP FUNCTION IF EXISTS get_my_leagues();

CREATE OR REPLACE FUNCTION get_my_leagues()
RETURNS TABLE(
  id                          UUID,
  name                        TEXT,
  invite_code                 TEXT,
  created_by                  TEXT,
  member_count                BIGINT,
  joined_at                   TIMESTAMPTZ,
  scoring_start_round_id      UUID,
  scoring_start_round_number  INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid TEXT := auth.uid()::text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.invite_code,
    l.created_by,
    (SELECT COUNT(*) FROM league_members lm2 WHERE lm2.league_id = l.id) AS member_count,
    lm.joined_at,
    l.scoring_start_round_id,
    sr.round_number AS scoring_start_round_number
  FROM league_members lm
  JOIN leagues l ON l.id = lm.league_id
  LEFT JOIN rounds sr ON sr.id = l.scoring_start_round_id
  WHERE lm.user_id = uid
  ORDER BY lm.joined_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_my_leagues() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_leagues() TO authenticated;

-- =====================================================
-- 4. get_league_leaderboard — filter by scoring start + autosub
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
  uid          TEXT := auth.uid()::text;
  start_id     UUID;
  start_number INT;
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

  SELECT l.scoring_start_round_id, sr.round_number
    INTO start_id, start_number
  FROM leagues l
  LEFT JOIN rounds sr ON sr.id = l.scoring_start_round_id
  WHERE l.id = input_league_id;

  RETURN QUERY
  WITH member_rounds AS (
    SELECT DISTINCT ugp.user_id, ugp.round_id
    FROM user_gw_picks ugp
    INNER JOIN league_members lm
      ON lm.user_id = ugp.user_id
     AND lm.league_id = input_league_id
    INNER JOIN rounds r ON r.id = ugp.round_id
    WHERE start_id IS NULL
       OR r.round_number >= start_number
  ),
  gw_scores AS (
    SELECT
      mr.user_id,
      mr.round_id,
      score_user_round_with_autosub(mr.user_id, mr.round_id)::bigint AS round_points
    FROM member_rounds mr
  ),
  user_totals AS (
    SELECT
      gs.user_id,
      COALESCE(SUM(gs.round_points), 0)::bigint AS gross_points,
      COUNT(DISTINCT gs.round_id)::bigint AS gw_count
    FROM gw_scores gs
    GROUP BY gs.user_id
  ),
  deduction_totals AS (
    SELECT
      urd.user_id,
      COALESCE(SUM(urd.deduction), 0)::bigint AS total_deduction
    FROM user_round_deductions urd
    INNER JOIN league_members lm_d
      ON lm_d.user_id = urd.user_id
     AND lm_d.league_id = input_league_id
    INNER JOIN rounds r ON r.id = urd.round_id
    WHERE start_id IS NULL
       OR r.round_number >= start_number
    GROUP BY urd.user_id
  ),
  ranked AS (
    SELECT
      lm.user_id,
      COALESCE(up.team_name, 'Unknown Team') AS team_name,
      (COALESCE(ut.gross_points, 0)
        - COALESCE(dt.total_deduction, 0))::integer AS total_points,
      COALESCE(ut.gw_count, 0) AS gameweeks_played,
      RANK() OVER (
        ORDER BY (COALESCE(ut.gross_points, 0)
          - COALESCE(dt.total_deduction, 0)) DESC
      ) AS rank
    FROM league_members lm
    LEFT JOIN user_totals ut ON ut.user_id = lm.user_id
    LEFT JOIN deduction_totals dt ON dt.user_id = lm.user_id
    LEFT JOIN user_profiles up ON up.user_id = lm.user_id
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
-- VERIFICATION
-- =====================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'leagues' AND column_name = 'scoring_start_round_id';
--
-- SELECT proname, pg_get_function_identity_arguments(oid)
-- FROM pg_proc
-- WHERE proname IN ('create_league', 'get_my_leagues', 'get_league_leaderboard');

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP FUNCTION IF EXISTS create_league(TEXT, BOOLEAN);
-- -- restore create_league(TEXT) from migration 014 if needed
-- DROP FUNCTION IF EXISTS get_my_leagues();
-- -- restore get_my_leagues() from migration 014 if needed
-- -- restore get_league_leaderboard from migration 018 if needed
-- ALTER TABLE leagues DROP COLUMN IF EXISTS scoring_start_round_id;
