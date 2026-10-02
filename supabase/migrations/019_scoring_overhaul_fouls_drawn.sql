-- Migration: Scoring overhaul (position-gated) + fouls drawn
-- Description:
--   - Goals +5, saves +1 each, penalty save +5, GK clean sheet period +10
--   - Add fouls_drawn (+2 each for GK and Outfield)
--   - Remove yellow_cards and minutes_played columns
--   - Position-gated scoring:
--       Outfield: goals, assists, appearance, blocks, sprints,
--                 fouls_drawn, clean sheet (+1/period), red
--       GK:       goals, assists, saves, penalty saves, appearance,
--                 fouls_drawn, clean sheet (+10/period), red
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--
-- Created: 2026-10-02

-- =====================================================
-- 1. ADD fouls_drawn
-- =====================================================
ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS fouls_drawn INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- 2. DROP season stats view BEFORE dropping columns it reads
-- =====================================================
DROP VIEW IF EXISTS player_season_stats;

-- =====================================================
-- 3. DROP unused columns
-- =====================================================
ALTER TABLE player_match_stats
  DROP COLUMN IF EXISTS yellow_cards,
  DROP COLUMN IF EXISTS minutes_played;

-- =====================================================
-- 4. SCORING FUNCTION (position-gated)
--    Drop all prior overloads first (arg lists changed).
-- =====================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE proname = 'calculate_player_match_points'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION calculate_player_match_points(
  p_goals          INTEGER,
  p_assists        INTEGER,
  p_saves          INTEGER,
  p_penalty_saves  INTEGER,
  p_appeared       BOOLEAN,
  p_red_cards      INTEGER DEFAULT 0,
  p_clean_sheets   INTEGER DEFAULT 0,
  p_position       TEXT    DEFAULT 'Outfield',
  p_blocks         INTEGER DEFAULT 0,
  p_sprints        INTEGER DEFAULT 0,
  p_fouls_drawn    INTEGER DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
  total_points INTEGER := 0;
BEGIN
  -- Shared: goals, assists, appearance, fouls drawn, red cards
  total_points := total_points + (COALESCE(p_goals, 0) * 5);
  total_points := total_points + (COALESCE(p_assists, 0) * 3);

  IF p_appeared THEN
    total_points := total_points + 1;
  END IF;

  total_points := total_points + (COALESCE(p_fouls_drawn, 0) * 2);
  total_points := total_points - (COALESCE(p_red_cards, 0) * 10);

  IF p_position = 'GK' THEN
    -- GK only: saves, penalty saves, clean sheet periods
    total_points := total_points + COALESCE(p_saves, 0);           -- +1 each
    total_points := total_points + (COALESCE(p_penalty_saves, 0) * 5);
    total_points := total_points + (COALESCE(p_clean_sheets, 0) * 10);
  ELSE
    -- Outfield only: blocks, sprints, clean sheet periods
    total_points := total_points + (COALESCE(p_blocks, 0) * 2);
    total_points := total_points + (COALESCE(p_sprints, 0) * 2);
    total_points := total_points + (COALESCE(p_clean_sheets, 0) * 1);
  END IF;

  RETURN total_points;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_player_match_stats_points()
RETURNS TRIGGER AS $$
DECLARE
  v_position TEXT;
BEGIN
  SELECT position INTO v_position FROM players WHERE id = NEW.player_id;

  NEW.points_earned := calculate_player_match_points(
    NEW.goals,
    NEW.assists,
    NEW.saves,
    NEW.penalty_saves,
    NEW.appeared,
    COALESCE(NEW.red_cards, 0),
    COALESCE(NEW.clean_sheets, 0),
    COALESCE(v_position, 'Outfield'),
    COALESCE(NEW.blocks, 0),
    COALESCE(NEW.sprints, 0),
    COALESCE(NEW.fouls_drawn, 0)
  );

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. RECREATE player_season_stats VIEW
-- =====================================================
CREATE VIEW player_season_stats AS
SELECT
  p.id,
  p.name,
  p.position,
  p.team_id,
  p.price,
  p.points_total,
  t.name    AS team_name,
  t.league,
  COUNT(pms.id)                          AS games_played,
  COALESCE(SUM(pms.goals), 0)            AS total_goals,
  COALESCE(SUM(pms.assists), 0)          AS total_assists,
  COALESCE(SUM(pms.saves), 0)            AS total_saves,
  COALESCE(SUM(pms.penalty_saves), 0)    AS total_penalty_saves,
  COALESCE(SUM(pms.blocks), 0)           AS total_blocks,
  COALESCE(SUM(pms.sprints), 0)          AS total_sprints,
  COALESCE(SUM(pms.clean_sheets), 0)     AS total_clean_sheets,
  COALESCE(SUM(pms.fouls_drawn), 0)      AS total_fouls_drawn,
  COALESCE(SUM(pms.red_cards), 0)        AS total_reds
FROM players p
LEFT JOIN teams t ON p.team_id = t.id
LEFT JOIN player_match_stats pms ON pms.player_id = p.id
GROUP BY
  p.id, p.name, p.position, p.team_id, p.price, p.points_total,
  t.name, t.league;

-- =====================================================
-- 7. RECOMPUTE existing match points under new rules
-- =====================================================
UPDATE player_match_stats
SET updated_at = NOW()
WHERE id IS NOT NULL;
-- Trigger fires on UPDATE and recalculates points_earned.

-- =====================================================
-- VERIFY
-- =====================================================
-- GK: 1 goal, 6 saves, 1 pen save, appeared, 2 fouls drawn, 2 CS periods
-- SELECT calculate_player_match_points(1, 0, 6, 1, true, 0, 2, 'GK', 0, 0, 2);
-- Expected: 5 + 1 + 6 + 5 + 4 + 20 = 41
--
-- OF: 2 goals, 1 assist, appeared, 1 block, 1 sprint, 1 foul, 2 CS, 1 red
-- SELECT calculate_player_match_points(2, 1, 0, 0, true, 1, 2, 'Outfield', 1, 1, 1);
-- Expected: 10 + 3 + 1 + 2 + 2 + 2 + 2 - 10 = 12
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'player_match_stats' ORDER BY ordinal_position;
