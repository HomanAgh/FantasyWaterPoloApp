-- Migration: Add yellow_cards, red_cards, and clean_sheet to player_match_stats
-- Description: Adds card tracking and clean sheet support, and updates the
--              scoring function + trigger to include the new columns.
-- Created: 2026-04-13
--
-- SCORING RULES:
--   Goal:           +5 pts
--   Assist:         +3 pts
--   Saves:          +1 pt per 2 saves (floor)
--   Penalty save:   +3 pts each
--   Appearance:     +1 pt
--   Clean sheet GK: +10 pts
--   Clean sheet outfield: +2 pts
--   Yellow card:    -2 pts
--   Red card:       -4 pts
-- =====================================================

-- =====================================================
-- 1. ADD NEW COLUMNS (safe to run even if already added)
-- =====================================================
ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS yellow_cards INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS red_cards    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clean_sheet  BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- 2. UPDATE SCORING FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_player_match_points(
  p_goals          INTEGER,
  p_assists        INTEGER,
  p_saves          INTEGER,
  p_penalty_saves  INTEGER,
  p_appeared       BOOLEAN,
  p_yellow_cards   INTEGER DEFAULT 0,
  p_red_cards      INTEGER DEFAULT 0,
  p_clean_sheet    BOOLEAN DEFAULT false,
  p_position       TEXT    DEFAULT 'Outfield'
)
RETURNS INTEGER AS $$
DECLARE
  total_points INTEGER := 0;
BEGIN
  -- Goals: 5 points each
  total_points := total_points + (p_goals * 5);

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

  -- Clean sheet: 10 pts for GK, 2 pts for outfield
  IF p_clean_sheet THEN
    IF p_position = 'GK' THEN
      total_points := total_points + 10;
    ELSE
      total_points := total_points + 2;
    END IF;
  END IF;

  -- Yellow card: -2 points each
  total_points := total_points - (p_yellow_cards * 2);

  -- Red card: -4 points each
  total_points := total_points - (p_red_cards * 4);

  RETURN total_points;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. UPDATE TRIGGER FUNCTION
--    Looks up player position so clean_sheet scoring
--    can be applied correctly per position.
-- =====================================================
CREATE OR REPLACE FUNCTION update_player_match_stats_points()
RETURNS TRIGGER AS $$
DECLARE
  v_position TEXT;
BEGIN
  -- Look up the player's position (GK or Outfield)
  SELECT position INTO v_position FROM players WHERE id = NEW.player_id;

  NEW.points_earned := calculate_player_match_points(
    NEW.goals,
    NEW.assists,
    NEW.saves,
    NEW.penalty_saves,
    NEW.appeared,
    COALESCE(NEW.yellow_cards, 0),
    COALESCE(NEW.red_cards, 0),
    COALESCE(NEW.clean_sheet, false),
    COALESCE(v_position, 'Outfield')
  );

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFY (run these to check everything is correct)
-- =====================================================
-- Check new columns exist:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'player_match_stats'
-- ORDER BY ordinal_position;

-- Test scoring manually:
-- SELECT calculate_player_match_points(2, 1, 10, 0, true, 1, 0, true, 'GK');
-- Expected: (2*5) + (1*3) + (10/2) + 1 + 10 - (1*2) = 10+3+5+1+10-2 = 27
