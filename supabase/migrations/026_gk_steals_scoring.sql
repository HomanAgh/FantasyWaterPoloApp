-- Migration: Goalkeepers score for steals (+2 each)
-- Description:
--   Steals were Outfield-only (migration 021). Move +2/steal into shared
--   scoring so GK and Outfield both earn points.
--   Does NOT recompute existing match points or round points — forward-only.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--
-- Created: 2026-10-29

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
  p_fouls_drawn    INTEGER DEFAULT 0,
  p_steals         INTEGER DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
  total_points INTEGER := 0;
BEGIN
  -- Shared: goals, assists, appearance, fouls drawn, steals, red cards
  total_points := total_points + (COALESCE(p_goals, 0) * 5);
  total_points := total_points + (COALESCE(p_assists, 0) * 3);

  IF p_appeared THEN
    total_points := total_points + 1;
  END IF;

  total_points := total_points + (COALESCE(p_fouls_drawn, 0) * 2);
  total_points := total_points + (COALESCE(p_steals, 0) * 2);
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

-- Optional verify:
-- OF: 1 steal only, appeared → 1 + 2 = 3
-- SELECT calculate_player_match_points(0, 0, 0, 0, true, 0, 0, 'Outfield', 0, 0, 0, 1);
--
-- GK: appeared + 1 steal → 1 + 2 = 3
-- SELECT calculate_player_match_points(0, 0, 0, 0, true, 0, 0, 'GK', 0, 0, 0, 1);
