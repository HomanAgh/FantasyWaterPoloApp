-- Migration: Gameweek Management & Live Scoring Features
-- Description: Adds gameweek tracking, captain selection, and per-round points
-- Created: 2026-03-05

-- =====================================================
-- 1. CREATE player_round_points TABLE
-- Track points earned per player per gameweek
-- =====================================================
CREATE TABLE IF NOT EXISTS player_round_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, round_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_player_round_points_player ON player_round_points(player_id);
CREATE INDEX IF NOT EXISTS idx_player_round_points_round ON player_round_points(round_id);
CREATE INDEX IF NOT EXISTS idx_player_round_points_player_round ON player_round_points(player_id, round_id);

-- Add RLS (Row Level Security) policies for player_round_points
ALTER TABLE player_round_points ENABLE ROW LEVEL SECURITY;

-- Allow all users to read player round points
CREATE POLICY "Anyone can view player round points"
  ON player_round_points FOR SELECT
  USING (true);

-- Allow all users to write player round points
-- Note: app uses anon key so auth.role() = 'anon', not 'authenticated'
CREATE POLICY "Anyone can manage player round points"
  ON player_round_points FOR ALL
  USING (true);

-- =====================================================
-- 2. MODIFY user_teams TABLE
-- Add captain selection column
-- =====================================================
ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false;

-- Create unique index to ensure only one captain per user
-- This constraint ensures a user can only have one captain at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_teams_captain 
  ON user_teams(user_id) 
  WHERE is_captain = true;

-- =====================================================
-- 3. MODIFY rounds TABLE
-- Add status tracking and deadline management
-- =====================================================
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'upcoming' 
  CHECK (status IN ('upcoming', 'active', 'completed'));

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE;

-- Update existing rounds to set deadline = start_date if not set
UPDATE rounds SET deadline = start_date WHERE deadline IS NULL;

-- Make deadline NOT NULL after setting defaults
ALTER TABLE rounds ALTER COLUMN deadline SET NOT NULL;

-- Create index for efficient deadline queries
CREATE INDEX IF NOT EXISTS idx_rounds_deadline ON rounds(deadline);
CREATE INDEX IF NOT EXISTS idx_rounds_status ON rounds(status);

-- =====================================================
-- VERIFICATION QUERIES (Run these to verify migration)
-- =====================================================

-- Verify player_round_points table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'player_round_points';

-- Verify user_teams captain column
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_teams' AND column_name = 'is_captain';

-- Verify rounds status and deadline columns
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'rounds' AND column_name IN ('status', 'deadline');

-- Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('player_round_points', 'user_teams', 'rounds');

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- DROP TABLE IF EXISTS player_round_points CASCADE;
-- ALTER TABLE user_teams DROP COLUMN IF EXISTS is_captain;
-- DROP INDEX IF EXISTS idx_user_teams_captain;
-- ALTER TABLE rounds DROP COLUMN IF EXISTS status;
-- ALTER TABLE rounds DROP COLUMN IF EXISTS deadline;
