-- Migration: Count games_played only when appeared = true
-- Description: player_season_stats was counting every player_match_stats row,
--              including DNP rows (appeared = false). Align with appearance logic.

DROP VIEW IF EXISTS player_season_stats;

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
  COUNT(pms.id) FILTER (WHERE pms.appeared = true) AS games_played,
  COALESCE(SUM(pms.goals), 0)            AS total_goals,
  COALESCE(SUM(pms.assists), 0)          AS total_assists,
  COALESCE(SUM(pms.saves), 0)            AS total_saves,
  COALESCE(SUM(pms.penalty_saves), 0)    AS total_penalty_saves,
  COALESCE(SUM(pms.blocks), 0)           AS total_blocks,
  COALESCE(SUM(pms.sprints), 0)          AS total_sprints,
  COALESCE(SUM(pms.steals), 0)           AS total_steals,
  COALESCE(SUM(pms.clean_sheets), 0)     AS total_clean_sheets,
  COALESCE(SUM(pms.fouls_drawn), 0)      AS total_fouls_drawn,
  COALESCE(SUM(pms.red_cards), 0)        AS total_reds
FROM players p
LEFT JOIN teams t ON p.team_id = t.id
LEFT JOIN player_match_stats pms ON pms.player_id = p.id
GROUP BY
  p.id, p.name, p.position, p.team_id, p.price, p.points_total,
  t.name, t.league;
