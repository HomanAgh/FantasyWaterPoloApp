-- Migration: Blocks, Sprints & Scoring Overhaul
-- Description: Adds blocks and sprints stats, converts clean_sheet (boolean)
--              to clean_sheets (integer, per period), and revises all point values.
-- Created: 2026-06-02
--
-- SCORING RULES (updated):
--   Goal:                      +4 pts  (was 5)
--   Assist:                    +3 pts
--   Saves:                     +1 pt per 2 saves (floor, unchanged)
--   Penalty save:              +3 pts each
--   Appearance:                +1 pt
--   Block:                     +2 pts each  (NEW)
--   Sprint:                    +2 pts each  (NEW)
--   Clean sheet period — GK:   +5 pts each  (was boolean +10)
--   Clean sheet period — OF:   +1 pt each   (was boolean +2)
--   Yellow card:                0 pts  (column kept, removed from scoring)
--   Red card:                  -10 pts  (was -4)
-- =====================================================

-- =====================================================
-- 1. ADD NEW COLUMNS
-- =====================================================
ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS blocks   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sprints  INTEGER NOT NULL DEFAULT 0;

-- Add the new integer clean_sheets column (tracks periods, not a boolean)
ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS clean_sheets INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- 2. MIGRATE clean_sheet BOOLEAN → clean_sheets INTEGER
--    Existing true rows become 1 period; false stays 0
-- =====================================================
UPDATE player_match_stats
  SET clean_sheets = 1
  WHERE clean_sheet = true AND clean_sheets = 0;

-- =====================================================
-- 3. DROP THE OLD BOOLEAN COLUMN
-- =====================================================
ALTER TABLE player_match_stats
  DROP COLUMN IF EXISTS clean_sheet;

-- =====================================================
-- 4. UPDATE SCORING FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_player_match_points(
  p_goals          INTEGER,
  p_assists        INTEGER,
  p_saves          INTEGER,
  p_penalty_saves  INTEGER,
  p_appeared       BOOLEAN,
  p_yellow_cards   INTEGER DEFAULT 0,
  p_red_cards      INTEGER DEFAULT 0,
  p_clean_sheets   INTEGER DEFAULT 0,
  p_position       TEXT    DEFAULT 'Outfield',
  p_blocks         INTEGER DEFAULT 0,
  p_sprints        INTEGER DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
  total_points INTEGER := 0;
BEGIN
  -- Goals: 4 points each
  total_points := total_points + (p_goals * 4);

  -- Assists: 3 points each
  total_points := total_points + (p_assists * 3);

  -- Saves: 1 point per 2 saves (rounded down)
  total_points := total_points + (p_saves / 2);

  -- Penalty saves: 3 points each
  total_points := total_points + (p_penalty_saves * 3);

  -- Appearance: 1 point for playing
  IF p_appeared THEN
    total_points := total_points + 1;
  END IF;

  -- Blocks: 2 points each
  total_points := total_points + (p_blocks * 2);

  -- Sprints: 2 points each
  total_points := total_points + (p_sprints * 2);

  -- Clean sheet periods: 5 pts per period for GK, 1 pt per period for outfield
  IF p_position = 'GK' THEN
    total_points := total_points + (p_clean_sheets * 5);
  ELSE
    total_points := total_points + (p_clean_sheets * 1);
  END IF;

  -- Yellow card: no longer scored (column kept for record-keeping)

  -- Red card: -10 points each
  total_points := total_points - (p_red_cards * 10);

  RETURN total_points;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. UPDATE TRIGGER FUNCTION
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
    COALESCE(NEW.yellow_cards, 0),
    COALESCE(NEW.red_cards, 0),
    COALESCE(NEW.clean_sheets, 0),
    COALESCE(v_position, 'Outfield'),
    COALESCE(NEW.blocks, 0),
    COALESCE(NEW.sprints, 0)
  );

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFY (paste into Supabase SQL editor to check)
-- =====================================================
-- Confirm new columns exist:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'player_match_stats'
-- ORDER BY ordinal_position;

-- Test scoring — GK, 1 goal, 6 saves, 2 blocks, 1 sprint, 3 clean sheet periods:
-- SELECT calculate_player_match_points(1, 0, 6, 0, true, 0, 0, 3, 'GK', 2, 1);
-- Expected: (1*4) + (6/2) + 1 + (2*2) + (1*2) + (3*5) = 4+3+1+4+2+15 = 29

-- Test scoring — Outfield, 2 goals, 1 assist, 2 clean sheet periods, 1 red card:
-- SELECT calculate_player_match_points(2, 1, 0, 0, true, 0, 1, 2, 'Outfield', 0, 0);
-- Expected: (2*4) + (1*3) + 1 + (2*1) - (1*10) = 8+3+1+2-10 = 4
