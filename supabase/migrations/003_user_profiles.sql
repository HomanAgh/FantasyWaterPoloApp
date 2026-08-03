-- Migration: User Profiles
-- Description: Adds user profiles with team names for personalization
-- Created: 2026-03-20

-- =====================================================
-- 1. CREATE user_profiles TABLE
-- Store user profile data including team name
-- =====================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  team_name TEXT NOT NULL DEFAULT 'My Team',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- =====================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow all users to read profiles
CREATE POLICY "Anyone can view user profiles"
  ON user_profiles FOR SELECT
  USING (true);

-- Allow all users to insert their own profile
CREATE POLICY "Anyone can create user profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

-- Allow all users to update profiles
CREATE POLICY "Anyone can update user profiles"
  ON user_profiles FOR UPDATE
  USING (true);

-- =====================================================
-- 3. CREATE UPDATE TRIGGER
-- Auto-update the updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
