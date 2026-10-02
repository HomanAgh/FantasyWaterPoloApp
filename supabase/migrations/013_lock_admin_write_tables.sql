-- Migration: Lock Admin Write Tables
-- Description: Removes open FOR ALL write policies on fixtures,
--              player_match_stats, and player_round_points so the anon key
--              in the mobile app cannot insert/update/delete scores or fixtures.
--              Public SELECT policies are left in place — the app still reads
--              these tables normally.
-- Created: 2026-08-10
--
-- BACKGROUND:
--   Migrations 002 and 004 added "Anyone can manage …" policies with
--   USING (true) so early development (anon-key-only, no auth) could write
--   test data from the client. With real auth and a store launch, that is a
--   security hole: anyone who extracts the anon key can change match results
--   and player points.
--
--   Admin workflow is unchanged: Supabase Dashboard SQL Editor / Table Editor
--   run as the postgres role and bypass RLS. Continue managing fixtures and
--   stats there (see docs/features/fixtures-admin-guide.md).
--
--   Client helpers marked "admin function" (updateFixture, updatePlayerPointsForRound,
--   batchUpdatePlayerPoints) will start failing if called — nothing in the UI
--   uses them for normal gameplay.

-- =====================================================
-- 1. DROP OPEN WRITE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Anyone can manage fixtures" ON fixtures;
DROP POLICY IF EXISTS "Anyone can manage player match stats" ON player_match_stats;
DROP POLICY IF EXISTS "Anyone can manage player round points" ON player_round_points;

-- =====================================================
-- VERIFICATION QUERIES (paste into SQL editor to check)
-- =====================================================

-- 1. Only SELECT policies should remain on these tables:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('fixtures', 'player_match_stats', 'player_round_points')
-- ORDER BY tablename, cmd;
-- Expected: view/SELECT policies only — no "manage" / ALL policies

-- 2. App read still works (run as authenticated user or via the app):
-- SELECT id, status, home_score, away_score FROM fixtures LIMIT 5;
-- SELECT player_id, points_earned FROM player_match_stats LIMIT 5;
-- SELECT player_id, round_id, points FROM player_round_points LIMIT 5;

-- =====================================================
-- ROLLBACK SCRIPT (if needed — restores open writes; do NOT use in production)
-- =====================================================
-- CREATE POLICY "Anyone can manage fixtures"
--   ON fixtures FOR ALL
--   USING (true);
--
-- CREATE POLICY "Anyone can manage player match stats"
--   ON player_match_stats FOR ALL
--   USING (true);
--
-- CREATE POLICY "Anyone can manage player round points"
--   ON player_round_points FOR ALL
--   USING (true);
