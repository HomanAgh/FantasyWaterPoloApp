-- Migration: Fixtures and Match Statistics
-- Description: Adds fixtures tracking and player match statistics
-- Created: 2026-03-23

-- =====================================================
-- 1. CREATE fixtures TABLE
-- Track matches between teams in each round
-- =====================================================
CREATE TABLE IF NOT EXISTS fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  home_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  home_score INTEGER,
  away_score INTEGER,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished')),
  venue TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_fixtures_round ON fixtures(round_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_home_team ON fixtures(home_team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_away_team ON fixtures(away_team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_match_date ON fixtures(match_date);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);

-- =====================================================
-- 2. CREATE player_match_stats TABLE
-- Track individual player performance in each match
-- =====================================================
CREATE TABLE IF NOT EXISTS player_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  penalty_saves INTEGER NOT NULL DEFAULT 0,
  minutes_played INTEGER NOT NULL DEFAULT 0,
  appeared BOOLEAN NOT NULL DEFAULT false,
  yellow_cards INTEGER NOT NULL DEFAULT 0,
  red_cards INTEGER NOT NULL DEFAULT 0,
  clean_sheet BOOLEAN NOT NULL DEFAULT false,
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fixture_id, player_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_player_match_stats_fixture ON player_match_stats(fixture_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_player ON player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_points ON player_match_stats(points_earned DESC);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on fixtures table
ALTER TABLE fixtures ENABLE ROW LEVEL SECURITY;

-- Allow all users to read fixtures
CREATE POLICY "Anyone can view fixtures"
  ON fixtures FOR SELECT
  USING (true);

-- Allow all users to write fixtures
-- Note: app uses anon key so auth.role() = 'anon', not 'authenticated'
CREATE POLICY "Anyone can manage fixtures"
  ON fixtures FOR ALL
  USING (true);

-- Enable RLS on player_match_stats table
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;

-- Allow all users to read player match stats
CREATE POLICY "Anyone can view player match stats"
  ON player_match_stats FOR SELECT
  USING (true);

-- Allow all users to write player match stats
-- Note: app uses anon key so auth.role() = 'anon', not 'authenticated'
CREATE POLICY "Anyone can manage player match stats"
  ON player_match_stats FOR ALL
  USING (true);

-- =====================================================
-- 4. TRIGGER TO AUTO-UPDATE updated_at TIMESTAMP
-- =====================================================

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for fixtures table
DROP TRIGGER IF EXISTS update_fixtures_updated_at ON fixtures;
CREATE TRIGGER update_fixtures_updated_at
  BEFORE UPDATE ON fixtures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create triggers for player_match_stats table
DROP TRIGGER IF EXISTS update_player_match_stats_updated_at ON player_match_stats;
CREATE TRIGGER update_player_match_stats_updated_at
  BEFORE UPDATE ON player_match_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES (Run these to verify migration)
-- =====================================================

-- Verify fixtures table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'fixtures';

-- Verify player_match_stats table structure (includes penalty_saves, appeared, clean_sheet)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'player_match_stats';

-- Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('fixtures', 'player_match_stats');

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- DROP TABLE IF EXISTS player_match_stats CASCADE;
-- DROP TABLE IF EXISTS fixtures CASCADE;
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
