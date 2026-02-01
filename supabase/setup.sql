-- ============================================
-- Fantasy Water Polo App - Database Setup
-- ============================================
-- 
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard > SQL Editor
-- 2. Click "New query"
-- 3. Copy and paste ALL of this SQL code
-- 4. Click "Run" (or press Ctrl+Enter)
-- 5. Verify tables were created in "Table Editor"
-- ============================================

-- ============================================
-- STEP 1: Create Tables
-- ============================================

-- Create teams table (real water polo teams)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  league TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('GK', 'Outfield')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  points_total INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_teams table (to store user's fantasy team selections)
CREATE TABLE IF NOT EXISTS user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- For now, we'll use a simple user identifier
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  is_starter BOOLEAN NOT NULL DEFAULT false,
  position_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, player_id)
);

-- Create transfers table (to track player transfers)
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  player_in_id UUID REFERENCES players(id) ON DELETE SET NULL,
  player_out_id UUID REFERENCES players(id) ON DELETE SET NULL,
  round INTEGER NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rounds table (to track game rounds/weeks)
CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number INTEGER NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 2: Create Indexes (for better performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_round ON transfers(round);

-- ============================================
-- STEP 3: Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create Security Policies
-- ============================================
-- Note: These policies allow public access for development.
-- You should restrict these in production with proper authentication.

-- Allow public read access on teams, players, and rounds
CREATE POLICY "Allow public read access on teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Allow public read access on players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public read access on rounds" ON rounds FOR SELECT USING (true);

-- Allow public access to user_teams (for development)
-- In production, add user_id checks: USING (auth.uid()::text = user_id)
CREATE POLICY "Allow public insert on user_teams" ON user_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on user_teams" ON user_teams FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on user_teams" ON user_teams FOR DELETE USING (true);
CREATE POLICY "Allow public select on user_teams" ON user_teams FOR SELECT USING (true);

-- Allow public access to transfers (for development)
CREATE POLICY "Allow public insert on transfers" ON transfers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select on transfers" ON transfers FOR SELECT USING (true);

-- ============================================
-- STEP 5: Insert Sample Data (Optional)
-- ============================================
-- Uncomment the section below to add sample data for testing

/*
-- Insert sample teams
INSERT INTO teams (name, league) VALUES
  ('USA National Team', 'International'),
  ('Serbia National Team', 'International'),
  ('Croatia National Team', 'International'),
  ('Italy National Team', 'International'),
  ('Spain National Team', 'International'),
  ('Hungary National Team', 'International'),
  ('Greece National Team', 'International'),
  ('Montenegro National Team', 'International')
ON CONFLICT DO NOTHING;

-- Insert sample players
-- Note: These will automatically link to teams based on name matching
INSERT INTO players (name, position, team_id, price, points_total) VALUES
  ('John Smith', 'GK', (SELECT id FROM teams WHERE name = 'USA National Team' LIMIT 1), 8.5, 120),
  ('Mike Johnson', 'Outfield', (SELECT id FROM teams WHERE name = 'USA National Team' LIMIT 1), 12.0, 150),
  ('Tom Williams', 'Outfield', (SELECT id FROM teams WHERE name = 'USA National Team' LIMIT 1), 11.5, 145),
  ('Marko Petrovic', 'GK', (SELECT id FROM teams WHERE name = 'Serbia National Team' LIMIT 1), 9.0, 135),
  ('Stefan Jovanovic', 'Outfield', (SELECT id FROM teams WHERE name = 'Serbia National Team' LIMIT 1), 13.0, 160),
  ('Ivan Horvat', 'Outfield', (SELECT id FROM teams WHERE name = 'Croatia National Team' LIMIT 1), 11.5, 140),
  ('Luka Novak', 'Outfield', (SELECT id FROM teams WHERE name = 'Croatia National Team' LIMIT 1), 10.5, 130),
  ('Luca Rossi', 'Outfield', (SELECT id FROM teams WHERE name = 'Italy National Team' LIMIT 1), 10.5, 130),
  ('Marco Bianchi', 'GK', (SELECT id FROM teams WHERE name = 'Italy National Team' LIMIT 1), 8.0, 115),
  ('Carlos Garcia', 'Outfield', (SELECT id FROM teams WHERE name = 'Spain National Team' LIMIT 1), 12.5, 155)
ON CONFLICT DO NOTHING;
*/

-- ============================================
-- Setup Complete!
-- ============================================
-- 
-- Next steps:
-- 1. Go to "Table Editor" in Supabase to verify tables were created
-- 2. Add your own teams and players data
-- 3. Configure your app with Supabase credentials (see SUPABASE_SETUP.md)
-- ============================================
