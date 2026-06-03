-- Migration: GW Squad Snapshots
-- Description: Creates the user_gw_picks table which stores a frozen snapshot
--              of each user's squad at the moment a gameweek deadline passes.
--              Points are calculated from this snapshot, not the live squad, so
--              post-deadline transfers never retroactively change past scores.
-- Created: 2026-05-20

-- =====================================================
-- 1. CREATE user_gw_picks TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_gw_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  is_starter BOOLEAN NOT NULL DEFAULT false,
  is_captain BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, round_id, player_id)
);

-- Indexes for the two most common access patterns:
--   1. Load all picks for a user+round (snapshot scoring)
--   2. Check which rounds a user has snapshots for (total points calc)
CREATE INDEX IF NOT EXISTS idx_user_gw_picks_user_round ON user_gw_picks(user_id, round_id);
CREATE INDEX IF NOT EXISTS idx_user_gw_picks_round ON user_gw_picks(round_id);

-- =====================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE user_gw_picks ENABLE ROW LEVEL SECURITY;

-- App uses anon key — auth.role() = 'anon', not 'authenticated'.
-- All operations are open; user isolation is handled at the app level via user_id.
CREATE POLICY "Anyone can manage gw picks"
  ON user_gw_picks FOR ALL
  USING (true);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_gw_picks'
-- ORDER BY ordinal_position;

-- Check a specific user's snapshot for round 1:
-- SELECT ugp.user_id, p.name, ugp.is_starter, ugp.is_captain
-- FROM user_gw_picks ugp
-- JOIN players p ON p.id = ugp.player_id
-- WHERE ugp.user_id = '[user-id]'
-- ORDER BY ugp.is_starter DESC, ugp.is_captain DESC;

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- DROP TABLE IF EXISTS user_gw_picks CASCADE;
