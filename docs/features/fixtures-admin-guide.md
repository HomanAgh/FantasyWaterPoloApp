# Fixtures Feature Setup Guide

## Overview

The Fixtures feature has been successfully implemented! This guide will help you set up the database tables and test the feature.

## What's Been Added

### 1. Database Migration (`supabase/migrations/004_fixtures_and_match_stats.sql`)
- **fixtures table**: Stores match information (teams, scores, dates, status)
- **player_match_stats table**: Tracks individual player performance in each match
- Indexes for optimal query performance
- Row Level Security policies
- Auto-update triggers for timestamps

### 2. Service Layer (`services/fixtureService.js`)
- `fetchFixturesForRound(roundId)` - Get all fixtures for a gameweek
- `fetchTopPerformers(fixtureId)` - Get top 3 players from a match
- `fetchAllFixtures()` - Get fixtures across recent rounds
- Helper functions for formatting dates and stats

### 3. UI Component (`screens/FixturesScreen.js`)
- Ocean-themed design matching the app style
- Gameweek selector (tabs for recent rounds)
- Fixture cards showing:
  - Team names and scores
  - Match date/time
  - Status badges (Scheduled/Live/Finished)
  - Top 3 performers with stats (for finished matches)
  - Venue information
- Pull-to-refresh functionality

### 4. Navigation (`App.js`)
- New "Fixtures" tab added between "Transfers" and "Leagues"
- 6 tabs total in the app navigation

## Setup Instructions

### Step 1: Run the Database Migration

1. Open your **Supabase Dashboard** (https://app.supabase.com)
2. Go to **SQL Editor**
3. Click **"New query"**
4. Open `supabase/migrations/004_fixtures_and_match_stats.sql` from this project
5. Copy and paste the entire SQL script
6. Click **"Run"** (or press Ctrl/Cmd + Enter)

You should see a success message. This creates the `fixtures` and `player_match_stats` tables.

### Step 2: Add Test Data (Optional)

To test the feature with sample data:

1. Still in the **SQL Editor**
2. Open `supabase/test_data/fixtures_test_data.sql`
3. Copy and paste the script
4. Click **"Run"**

This will create sample fixtures and player statistics using your existing teams and players.

**Note**: Make sure you have at least 2 teams and 1 round in your database first!

### Step 3: Verify the Installation

Run this query in SQL Editor to check if tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('fixtures', 'player_match_stats');
```

You should see both tables listed.

### Step 4: Test the App

1. **Start your app**: `npm start` or `npx expo start`
2. Open the app on your device/emulator
3. Navigate to the **Fixtures** tab (6th tab in navigation)
4. You should see:
   - A header with wave emoji and "Fixtures" title
   - Gameweek selector tabs at the top
   - Fixture cards displaying matches (if you added test data)
   - Or "No fixtures scheduled" if no data exists

## Using the Fixtures Feature

### For Users (App Experience)

1. **Switch Gameweeks**: Tap on the "GW 1", "GW 2" tabs to view different rounds
2. **View Match Info**: See teams, scores, dates, and status
3. **Check Top Performers**: For finished matches, see the top 3 point scorers
4. **Pull to Refresh**: Swipe down to reload fixtures

### For Admins (Adding Fixture Data)

#### Add a New Fixture

```sql
INSERT INTO fixtures (round_id, home_team_id, away_team_id, match_date, status, venue)
VALUES (
  'your-round-uuid',
  'home-team-uuid', 
  'away-team-uuid',
  '2026-03-25 18:00:00+00',  -- Match date/time (UTC)
  'scheduled',                -- Status: scheduled, live, or finished
  'Arena Name, City'          -- Venue (optional)
);
```

#### Update Match Result

```sql
UPDATE fixtures 
SET 
  status = 'finished',
  home_score = 12,
  away_score = 10,
  updated_at = NOW()
WHERE id = 'fixture-uuid';
```

#### Add Player Match Stats

```sql
INSERT INTO player_match_stats
  (fixture_id, player_id, goals, assists, saves, penalty_saves,
   minutes_played, appeared, yellow_cards, red_cards, clean_sheets, blocks, sprints)
VALUES
  ('fixture-uuid', 'player-uuid', 2, 1, 0, 0, 32, true, 0, 0, 0, 0, 0)
ON CONFLICT (fixture_id, player_id)
DO UPDATE SET
  goals          = EXCLUDED.goals,
  assists        = EXCLUDED.assists,
  saves          = EXCLUDED.saves,
  penalty_saves  = EXCLUDED.penalty_saves,
  minutes_played = EXCLUDED.minutes_played,
  appeared       = EXCLUDED.appeared,
  yellow_cards   = EXCLUDED.yellow_cards,
  red_cards      = EXCLUDED.red_cards,
  clean_sheets   = EXCLUDED.clean_sheets,
  blocks         = EXCLUDED.blocks,
  sprints        = EXCLUDED.sprints;
```

**Important**: Do NOT include `points_earned` in the insert — the database trigger calculates it automatically based on the scoring rules below.

**Re-running the query is safe**: the `ON CONFLICT` clause means running it again with updated values will overwrite the previous entry for that player/fixture combination.

#### Scoring Rules (as of migration 009)

| Stat | Points |
|------|--------|
| Goal | +4 pts each |
| Assist | +3 pts each |
| Save | +1 pt per 2 saves (floor) |
| Penalty save | +3 pts each |
| Appearance (`appeared = true`) | +1 pt |
| Block | +2 pts each |
| Sprint | +2 pts each |
| Clean sheet period — GK | +5 pts per period |
| Clean sheet period — Outfield | +1 pt per period |
| Yellow card | no points effect (tracked for records only) |
| Red card | -10 pts each |

**Tips**:
- `clean_sheets` is an integer representing how many periods had no goals conceded (0–4)
- `appeared` should be `true` if the player played any minutes, `false` if they did not play
- Add stats for all players who appeared — the app shows the top 3 performers sorted by points automatically

## Database Schema Reference

### fixtures table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| round_id | UUID | Reference to rounds table |
| home_team_id | UUID | Home team reference |
| away_team_id | UUID | Away team reference |
| home_score | INTEGER | Home team score (null if not finished) |
| away_score | INTEGER | Away team score (null if not finished) |
| match_date | TIMESTAMP | Match date and time |
| status | TEXT | 'scheduled', 'live', or 'finished' |
| venue | TEXT | Match venue (optional) |

### player_match_stats table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| fixture_id | UUID | Reference to fixtures table |
| player_id | UUID | Reference to players table |
| goals | INTEGER | Goals scored |
| assists | INTEGER | Assists made |
| saves | INTEGER | Saves made |
| penalty_saves | INTEGER | Penalty saves made |
| minutes_played | INTEGER | Minutes played |
| appeared | BOOLEAN | Whether the player played at all |
| blocks | INTEGER | Blocks made |
| sprints | INTEGER | Sprints made |
| clean_sheets | INTEGER | Number of periods with no goals conceded (0–4) |
| yellow_cards | INTEGER | Yellow cards received (tracked, not scored) |
| red_cards | INTEGER | Red cards received |
| points_earned | INTEGER | Auto-calculated by DB trigger — do not set manually |

## Troubleshooting

### Issue: "No fixtures scheduled" message

**Solution**: 
- Check if you have fixtures in the database: `SELECT * FROM fixtures;`
- Ensure fixtures are associated with existing rounds
- Run the test data script to add sample fixtures

### Issue: Top performers not showing

**Solution**:
- Verify fixture status is 'finished'
- Check if player_match_stats exist for that fixture
- Ensure `points_earned` values are set (not 0 or null)

### Issue: Gameweek tabs not appearing

**Solution**:
- Ensure you have rounds in the database: `SELECT * FROM rounds;`
- Check that rounds have valid round_number values

### Issue: App crashes on Fixtures tab

**Solution**:
- Check console logs for errors
- Verify the migration was run successfully
- Ensure RLS policies allow SELECT on fixtures and player_match_stats

## Feature Highlights

✅ **Ocean-Themed Design**: Consistent with app's water polo theme  
✅ **Real-Time Updates**: Pull-to-refresh support  
✅ **Top Performers**: Showcases best players from each match  
✅ **Multi-Gameweek**: Easy navigation between rounds  
✅ **Status Badges**: Clear visual indicators for match status  
✅ **Optimized Queries**: JOIN operations for efficient data loading  
✅ **Empty States**: Graceful handling when no fixtures exist  

## Next Steps

1. **Populate with Real Data**: Add your actual fixtures and match results
2. **Integrate with Scoring System**: Connect player_match_stats to your points calculation
3. **Add Push Notifications**: Notify users when matches are live or finished
4. **Live Scores**: Implement real-time score updates during matches

## Support

If you encounter any issues:
1. Check the console logs for error messages
2. Verify database tables and policies in Supabase
3. Ensure all migrations have been run in order (002, 003, 004)
4. Check that your Supabase config is correct

---

**Congratulations!** 🎉 Your Fixtures feature is ready to use!
