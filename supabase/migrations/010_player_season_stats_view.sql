-- Migration: Player Season Stats View
-- Description: Creates a view that aggregates all player_match_stats per player
--              so the Players list can show and sort by individual stats without
--              per-player queries.
-- Created: 2026-06-03
--
-- USAGE: Query this view exactly like the players table — it returns one row
--        per player with all season totals already summed.
--        The view is read-only and does not affect any existing tables.
-- =====================================================

CREATE OR REPLACE VIEW player_season_stats AS
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
  COALESCE(SUM(pms.yellow_cards), 0)     AS total_yellows,
  COALESCE(SUM(pms.red_cards), 0)        AS total_reds,
  COALESCE(SUM(pms.minutes_played), 0)   AS total_minutes
FROM players p
LEFT JOIN teams t ON p.team_id = t.id
LEFT JOIN player_match_stats pms ON pms.player_id = p.id
GROUP BY
  p.id, p.name, p.position, p.team_id, p.price, p.points_total,
  t.name, t.league;

-- =====================================================
-- VERIFY (paste into Supabase SQL editor)
-- =====================================================
-- SELECT id, name, total_goals, total_assists, total_saves, total_blocks
-- FROM player_season_stats
-- ORDER BY points_total DESC
-- LIMIT 10;
