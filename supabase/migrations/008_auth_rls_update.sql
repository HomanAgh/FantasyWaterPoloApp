-- Migration: Auth-aware RLS Policies
-- Description: Tighten write policies so each user can only modify their own rows.
--              Users must be authenticated via Supabase Auth.
--              user_id columns continue to store the auth UUID as TEXT so the
--              schema shape doesn't change.
-- Created: 2026-05-22
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste and run.
--
-- NOTE ON EXISTING DATA:
--   Any rows created before auth was added (with the old random user_id strings)
--   will no longer be writable by any authenticated user, because their user_id
--   values don't match any auth.uid().  The safest approach is to clear old test
--   data and start fresh after running this migration.
--
--   To wipe all user data and start clean:
--     TRUNCATE user_teams, transfers, user_profiles, user_gw_picks, user_round_deductions RESTART IDENTITY CASCADE;

-- =====================================================
-- user_profiles
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can create user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can update user profiles" ON user_profiles;

-- Anyone can read profiles (leaderboard shows team names)
CREATE POLICY "Public read on user_profiles"
  ON user_profiles FOR SELECT
  USING (true);

-- Users can only insert their own profile
CREATE POLICY "Authenticated insert on user_profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can only update their own profile
CREATE POLICY "Authenticated update on user_profiles"
  ON user_profiles FOR UPDATE
  USING (auth.uid()::text = user_id);

-- =====================================================
-- user_teams
-- =====================================================
DROP POLICY IF EXISTS "Allow public insert on user_teams" ON user_teams;
DROP POLICY IF EXISTS "Allow public update on user_teams" ON user_teams;
DROP POLICY IF EXISTS "Allow public delete on user_teams" ON user_teams;
DROP POLICY IF EXISTS "Allow public select on user_teams" ON user_teams;

-- Only the owning user can read their squad
CREATE POLICY "Authenticated select on user_teams"
  ON user_teams FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Authenticated insert on user_teams"
  ON user_teams FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Authenticated update on user_teams"
  ON user_teams FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Authenticated delete on user_teams"
  ON user_teams FOR DELETE
  USING (auth.uid()::text = user_id);

-- =====================================================
-- transfers
-- =====================================================
DROP POLICY IF EXISTS "Allow public insert on transfers" ON transfers;
DROP POLICY IF EXISTS "Allow public select on transfers" ON transfers;

CREATE POLICY "Authenticated select on transfers"
  ON transfers FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Authenticated insert on transfers"
  ON transfers FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- =====================================================
-- user_gw_picks
-- =====================================================
-- Drop any existing open policies (the handoff notes these were fixed to USING(true))
DROP POLICY IF EXISTS "Users can view their own picks" ON user_gw_picks;
DROP POLICY IF EXISTS "Users can insert their own picks" ON user_gw_picks;
DROP POLICY IF EXISTS "Users can update their own picks" ON user_gw_picks;
DROP POLICY IF EXISTS "Allow public select on user_gw_picks" ON user_gw_picks;
DROP POLICY IF EXISTS "Allow public insert on user_gw_picks" ON user_gw_picks;
DROP POLICY IF EXISTS "Allow public update on user_gw_picks" ON user_gw_picks;

CREATE POLICY "Authenticated select on user_gw_picks"
  ON user_gw_picks FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Authenticated insert on user_gw_picks"
  ON user_gw_picks FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Authenticated update on user_gw_picks"
  ON user_gw_picks FOR UPDATE
  USING (auth.uid()::text = user_id);

-- =====================================================
-- user_round_deductions
-- =====================================================
DROP POLICY IF EXISTS "Anyone can manage round deductions" ON user_round_deductions;

CREATE POLICY "Authenticated select on user_round_deductions"
  ON user_round_deductions FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Authenticated insert on user_round_deductions"
  ON user_round_deductions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Authenticated update on user_round_deductions"
  ON user_round_deductions FOR UPDATE
  USING (auth.uid()::text = user_id);

-- =====================================================
-- Public read-only tables (no change needed — already open reads)
-- teams, players, rounds, fixtures, player_round_points, player_match_stats
-- These stay as USING (true) for SELECT — all users need to read them.
-- =====================================================

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check policies are in place:
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
