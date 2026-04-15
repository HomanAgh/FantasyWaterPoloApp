-- Test Data for Fixtures Feature
-- This script adds sample fixtures and match statistics for testing
-- Run this AFTER running the 004_fixtures_and_match_stats.sql migration

-- =====================================================
-- PREREQUISITE: Ensure you have teams and rounds in the database
-- =====================================================

-- This script assumes you have at least 2 teams and 1 round
-- If you don't have teams yet, uncomment and run this first:

/*
INSERT INTO teams (name, league) VALUES 
  ('Olympiacos SFP', 'Champions League'),
  ('AN Brescia', 'Champions League'),
  ('Pro Recco', 'Champions League'),
  ('Ferencvaros', 'Champions League')
ON CONFLICT DO NOTHING;
*/

-- Get round IDs (using the first round in the database)
DO $$
DECLARE
  round1_id UUID;
  team1_id UUID;
  team2_id UUID;
  team3_id UUID;
  team4_id UUID;
  fixture1_id UUID;
  fixture2_id UUID;
  player1_id UUID;
  player2_id UUID;
  player3_id UUID;
BEGIN
  -- Get the first round
  SELECT id INTO round1_id FROM rounds ORDER BY round_number LIMIT 1;
  
  -- Get team IDs (take first 4 teams)
  SELECT id INTO team1_id FROM teams ORDER BY name LIMIT 1 OFFSET 0;
  SELECT id INTO team2_id FROM teams ORDER BY name LIMIT 1 OFFSET 1;
  SELECT id INTO team3_id FROM teams ORDER BY name LIMIT 1 OFFSET 2;
  SELECT id INTO team4_id FROM teams ORDER BY name LIMIT 1 OFFSET 3;
  
  -- Exit if we don't have enough data
  IF round1_id IS NULL OR team1_id IS NULL OR team2_id IS NULL THEN
    RAISE NOTICE 'Not enough rounds or teams in database. Please add teams and rounds first.';
    RETURN;
  END IF;
  
  -- Insert sample fixtures
  INSERT INTO fixtures (round_id, home_team_id, away_team_id, home_score, away_score, match_date, status, venue)
  VALUES 
    (round1_id, team1_id, team2_id, 12, 10, NOW() - INTERVAL '2 days', 'finished', 'Olympic Pool, Athens'),
    (round1_id, team3_id, team4_id, 9, 11, NOW() - INTERVAL '1 day', 'finished', 'Brescia Pool, Italy')
  ON CONFLICT DO NOTHING
  RETURNING id INTO fixture1_id;
  
  -- Get the fixture IDs for adding player stats
  SELECT id INTO fixture1_id FROM fixtures WHERE round_id = round1_id ORDER BY match_date LIMIT 1;
  SELECT id INTO fixture2_id FROM fixtures WHERE round_id = round1_id ORDER BY match_date LIMIT 1 OFFSET 1;
  
  -- Get some player IDs (use first 3 players from team1 and team2)
  SELECT id INTO player1_id FROM players WHERE team_id = team1_id LIMIT 1 OFFSET 0;
  SELECT id INTO player2_id FROM players WHERE team_id = team1_id LIMIT 1 OFFSET 1;
  SELECT id INTO player3_id FROM players WHERE team_id = team2_id LIMIT 1 OFFSET 0;
  
  -- Insert player match stats for fixture 1 (if we have players)
  IF player1_id IS NOT NULL THEN
    INSERT INTO player_match_stats 
      (fixture_id, player_id, goals, assists, saves, minutes_played, points_earned)
    VALUES 
      (fixture1_id, player1_id, 3, 2, 0, 32, 15),
      (fixture1_id, player2_id, 2, 1, 0, 32, 11),
      (fixture1_id, player3_id, 1, 2, 12, 32, 13)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RAISE NOTICE 'Test fixtures and player stats created successfully!';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating test data: %', SQLERRM;
END $$;

-- =====================================================
-- VERIFY TEST DATA
-- =====================================================

-- View all fixtures with team names
SELECT 
  f.id,
  r.round_number,
  ht.name as home_team,
  f.home_score,
  at.name as away_team,
  f.away_score,
  f.match_date,
  f.status,
  f.venue
FROM fixtures f
JOIN teams ht ON f.home_team_id = ht.id
JOIN teams at ON f.away_team_id = at.id
JOIN rounds r ON f.round_id = r.id
ORDER BY f.match_date DESC;

-- View player match stats
SELECT 
  p.name as player_name,
  t.name as team_name,
  pms.goals,
  pms.assists,
  pms.saves,
  pms.points_earned,
  ht.name as home_team,
  at.name as away_team
FROM player_match_stats pms
JOIN players p ON pms.player_id = p.id
JOIN teams t ON p.team_id = t.id
JOIN fixtures f ON pms.fixture_id = f.id
JOIN teams ht ON f.home_team_id = ht.id
JOIN teams at ON f.away_team_id = at.id
ORDER BY pms.points_earned DESC;

-- =====================================================
-- NOTES FOR TESTING
-- =====================================================
-- 
-- After running this script:
-- 1. Open the Fantasy Water Polo app
-- 2. Navigate to the Fixtures tab
-- 3. You should see the test fixtures with:
--    - Team names and scores
--    - Match dates and status badges
--    - Top 3 performers for finished matches
-- 
-- To add more fixtures manually:
-- INSERT INTO fixtures (round_id, home_team_id, away_team_id, match_date, status)
-- VALUES ('[round-id]', '[team1-id]', '[team2-id]', NOW() + INTERVAL '3 days', 'scheduled');
--
-- To update a fixture to finished with scores:
-- UPDATE fixtures 
-- SET status = 'finished', home_score = 10, away_score = 8
-- WHERE id = '[fixture-id]';
--
