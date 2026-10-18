-- Migration 023: Rewarded-ad unlock for banked free transfers
-- free_transfers = banked count (0–2)
-- unlocked_free_transfers = how many banked slots are unlocked via ads this GW

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS unlocked_free_transfers INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN user_profiles.unlocked_free_transfers IS
  'Free transfers unlocked by rewarded ads; capped at free_transfers. Reset on GW rollover.';
