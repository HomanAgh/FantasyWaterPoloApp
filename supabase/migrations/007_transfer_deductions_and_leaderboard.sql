-- Migration: Transfer State, Paid Deductions & Global Leaderboard
-- Description: Adds transfer-management columns to user_profiles, creates a
--              permanent deductions ledger, and builds the global_leaderboard
--              view + get_user_global_rank RPC that HomeScreen and LeaguesScreen
--              depend on.
-- Created: 2026-05-20
--
-- CONTEXT ON DEDUCTION STORAGE (two places by design):
--   user_profiles.pending_deductions  — live display only; reset to 0 each GW
--   user_round_deductions             — permanent ledger; never reset
--   global_leaderboard subtracts SUM(user_round_deductions) so the total is
--   always correct even after pending_deductions resets at rollover.

-- =====================================================
-- 1. ADD TRANSFER-STATE COLUMNS TO user_profiles
-- =====================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS free_transfers INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_transfer_round_id UUID REFERENCES rounds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfers_made_this_round INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS squad_finalized BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_deductions INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- 2. CREATE user_round_deductions TABLE
-- Permanent record of paid transfer point hits, one row per user per round.
-- The value stored is the cumulative deduction for that round (not per-transfer).
-- =====================================================
CREATE TABLE IF NOT EXISTS user_round_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  deduction INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, round_id)
);

CREATE INDEX IF NOT EXISTS idx_user_round_deductions_user ON user_round_deductions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_round_deductions_round ON user_round_deductions(round_id);

ALTER TABLE user_round_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage round deductions"
  ON user_round_deductions FOR ALL
  USING (true);

-- Auto-update updated_at on changes
CREATE TRIGGER update_user_round_deductions_updated_at
  BEFORE UPDATE ON user_round_deductions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. CREATE global_leaderboard VIEW
-- Sums each user's points across all locked GW snapshots (user_gw_picks →
-- player_round_points, doubling captain score), then subtracts permanent
-- paid-transfer deductions.
-- =====================================================
CREATE OR REPLACE VIEW global_leaderboard AS
WITH gw_scores AS (
  SELECT
    ugp.user_id,
    ugp.round_id,
    SUM(
      CASE WHEN ugp.is_starter
        THEN COALESCE(prp.points, 0) * (CASE WHEN ugp.is_captain THEN 2 ELSE 1 END)
        ELSE 0
      END
    ) AS round_points
  FROM user_gw_picks ugp
  LEFT JOIN player_round_points prp
    ON prp.player_id = ugp.player_id
   AND prp.round_id  = ugp.round_id
  GROUP BY ugp.user_id, ugp.round_id
),
user_totals AS (
  SELECT
    gs.user_id,
    COALESCE(SUM(gs.round_points), 0) AS gross_points
  FROM gw_scores gs
  GROUP BY gs.user_id
),
deduction_totals AS (
  SELECT
    user_id,
    SUM(deduction) AS total_deduction
  FROM user_round_deductions
  GROUP BY user_id
)
SELECT
  ut.user_id,
  COALESCE(up.team_name, 'Unknown Team') AS team_name,
  (ut.gross_points - COALESCE(dt.total_deduction, 0))::INTEGER AS total_points,
  RANK() OVER (
    ORDER BY (ut.gross_points - COALESCE(dt.total_deduction, 0)) DESC
  ) AS rank
FROM user_totals ut
LEFT JOIN deduction_totals dt ON dt.user_id = ut.user_id
LEFT JOIN user_profiles    up ON up.user_id = ut.user_id;

-- =====================================================
-- 4. CREATE get_user_global_rank FUNCTION
-- Used by TeamContext to load lockedTotalPoints and by LeaguesScreen for rank.
-- Returns: rank BIGINT, total_points INTEGER, total_users BIGINT
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_global_rank(input_user_id TEXT)
RETURNS TABLE(rank BIGINT, total_points INTEGER, total_users BIGINT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH lb AS (
    SELECT
      gl.user_id,
      gl.total_points,
      gl.rank AS user_rank
    FROM global_leaderboard gl
  )
  SELECT
    (SELECT user_rank FROM lb WHERE lb.user_id = input_user_id),
    (SELECT lb.total_points FROM lb WHERE lb.user_id = input_user_id),
    COUNT(*)::BIGINT AS total_users
  FROM lb;
END;
$$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check new user_profiles columns:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'user_profiles'
-- ORDER BY ordinal_position;

-- Inspect the leaderboard:
-- SELECT * FROM global_leaderboard ORDER BY rank LIMIT 20;

-- Test the RPC (replace with a real user_id):
-- SELECT * FROM get_user_global_rank('[user-id]');

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- DROP FUNCTION IF EXISTS get_user_global_rank(TEXT);
-- DROP VIEW IF EXISTS global_leaderboard;
-- DROP TABLE IF EXISTS user_round_deductions CASCADE;
-- ALTER TABLE user_profiles
--   DROP COLUMN IF EXISTS free_transfers,
--   DROP COLUMN IF EXISTS last_transfer_round_id,
--   DROP COLUMN IF EXISTS transfers_made_this_round,
--   DROP COLUMN IF EXISTS squad_finalized,
--   DROP COLUMN IF EXISTS pending_deductions;
