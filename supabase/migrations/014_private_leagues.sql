-- Migration: Private Leagues
-- Description: Adds private mini-leagues with invite-code join, plus SECURITY
--              DEFINER RPCs for create / join / list / standings. The client
--              never reads or writes leagues tables directly — all access is
--              through these functions so invite codes cannot be enumerated
--              and leaderboard scoring can bypass RLS on user_gw_picks.
-- Created: 2026-08-17
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--
-- BACKGROUND:
--   Global standings already live in get_global_leaderboard() (migration 012).
--   A private league is a membership list plus the same season totals, ranked
--   among members only. Members with no GW picks yet still appear at 0 pts.
--
--   SECURITY DEFINER is required for the same reason as the global board:
--   user_gw_picks and user_round_deductions are RLS-locked to the row owner.
--   Each function still checks auth.uid() so a caller cannot create/join as
--   someone else, list other people's leagues, or read a league they are not in.

-- =====================================================
-- 1. TABLES
-- =====================================================
CREATE TABLE IF NOT EXISTS leagues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leagues_created_by ON leagues(created_by);

CREATE TABLE IF NOT EXISTS league_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  joined_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_league_members_user ON league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_league_members_league ON league_members(league_id);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- No client policies on purpose. Default-deny RLS + SECURITY DEFINER RPCs
-- means the anon key cannot SELECT/INSERT these tables from the app.
-- Table owner (postgres) still bypasses RLS when the RPCs run.

-- =====================================================
-- 2. generate_league_invite_code() — internal helper
--    6 chars from a 32-char alphabet (no 0/O/1/I). Not granted to clients.
-- =====================================================
CREATE OR REPLACE FUNCTION generate_league_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code     TEXT;
  i        INT;
  n        INT;
BEGIN
  FOR n IN 1..20 LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM leagues WHERE invite_code = code) THEN
      RETURN code;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Could not generate a unique invite code';
END;
$$;

REVOKE ALL ON FUNCTION generate_league_invite_code() FROM PUBLIC;

-- =====================================================
-- 3. create_league(league_name)
--    Validates name, inserts the league, auto-joins the creator.
-- =====================================================
CREATE OR REPLACE FUNCTION create_league(league_name TEXT)
RETURNS TABLE(
  id          UUID,
  name        TEXT,
  invite_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid        TEXT := auth.uid()::text;
  trimmed    TEXT;
  new_id     UUID;
  new_code   TEXT;
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

  new_code := generate_league_invite_code();

  INSERT INTO leagues (name, invite_code, created_by)
  VALUES (trimmed, new_code, uid)
  RETURNING leagues.id INTO new_id;

  INSERT INTO league_members (league_id, user_id)
  VALUES (new_id, uid);

  RETURN QUERY
  SELECT new_id, trimmed, new_code;
END;
$$;

REVOKE ALL ON FUNCTION create_league(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_league(TEXT) TO authenticated;

-- =====================================================
-- 4. join_league(input_code)
--    Looks up by code (never lists leagues). Already-a-member is a no-op
--    that still returns the league so repeat joins are safe.
-- =====================================================
CREATE OR REPLACE FUNCTION join_league(input_code TEXT)
RETURNS TABLE(
  id          UUID,
  name        TEXT,
  invite_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid       TEXT := auth.uid()::text;
  normalised TEXT;
  found_id   UUID;
  found_name TEXT;
  found_code TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  normalised := upper(btrim(input_code));

  IF length(normalised) <> 6 THEN
    RAISE EXCEPTION 'Invalid league code';
  END IF;

  SELECT l.id, l.name, l.invite_code
    INTO found_id, found_name, found_code
  FROM leagues l
  WHERE l.invite_code = normalised;

  IF found_id IS NULL THEN
    RAISE EXCEPTION 'Invalid league code';
  END IF;

  INSERT INTO league_members (league_id, user_id)
  VALUES (found_id, uid)
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN QUERY
  SELECT found_id, found_name, found_code;
END;
$$;

REVOKE ALL ON FUNCTION join_league(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_league(TEXT) TO authenticated;

-- =====================================================
-- 5. get_my_leagues()
--    Leagues the current user belongs to, with member count.
--    Rank is left to get_league_leaderboard / get_user_league_rank.
-- =====================================================
CREATE OR REPLACE FUNCTION get_my_leagues()
RETURNS TABLE(
  id           UUID,
  name         TEXT,
  invite_code  TEXT,
  created_by   TEXT,
  member_count BIGINT,
  joined_at    TIMESTAMPTZ
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
    lm.joined_at
  FROM league_members lm
  JOIN leagues l ON l.id = lm.league_id
  WHERE lm.user_id = uid
  ORDER BY lm.joined_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_my_leagues() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_leagues() TO authenticated;

-- =====================================================
-- 6. get_league_leaderboard(input_league_id, limit, offset)
--    Same scoring as get_global_leaderboard, restricted to members.
--    Members with no picks still appear (0 pts). Caller must be a member.
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
-- 7. get_user_league_rank(input_league_id)
--    Current user's rank / points / member count in one league.
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
-- VERIFICATION QUERIES (run after the migration, while logged into SQL Editor)
-- =====================================================

-- 1. Tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN ('leagues', 'league_members');

-- 2. Functions are SECURITY DEFINER and granted only to authenticated:
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'create_league', 'join_league', 'get_my_leagues',
--     'get_league_leaderboard', 'get_user_league_rank'
--   );
-- Expected: security_type = 'DEFINER' for all five.

-- 3. No client policies (default deny):
-- SELECT tablename, policyname FROM pg_policies
-- WHERE tablename IN ('leagues', 'league_members');
-- Expected: 0 rows.

-- 4. Smoke test as a real user (Dashboard → SQL Editor cannot call auth.uid()
--    unless you use the app). After the app is wired:
--    create_league('Office League')
--    join_league('ABC123')
--    get_my_leagues()
--    get_league_leaderboard('<league-uuid>', 50, 0)
--    get_user_league_rank('<league-uuid>')

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- DROP FUNCTION IF EXISTS get_user_league_rank(UUID);
-- DROP FUNCTION IF EXISTS get_league_leaderboard(UUID, INT, INT);
-- DROP FUNCTION IF EXISTS get_my_leagues();
-- DROP FUNCTION IF EXISTS join_league(TEXT);
-- DROP FUNCTION IF EXISTS create_league(TEXT);
-- DROP FUNCTION IF EXISTS generate_league_invite_code();
-- DROP TABLE IF EXISTS league_members CASCADE;
-- DROP TABLE IF EXISTS leagues CASCADE;
