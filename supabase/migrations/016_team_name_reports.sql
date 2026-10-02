-- Migration: Team name reports
-- Description: Lets authenticated users report another manager's team name
--              as offensive. Reports land in team_name_reports for manual
--              review in the Supabase Table Editor / SQL Editor. No email
--              or push notification — check open rows when moderating.
-- Created: 2026-08-21
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--
-- HOW TO REVIEW (admin):
--   SELECT *
--   FROM team_name_reports
--   WHERE status = 'open'
--   ORDER BY created_at DESC;
--
--   If valid, rename the profile then resolve:
--     UPDATE user_profiles SET team_name = 'Manager' WHERE user_id = '<id>';
--     UPDATE team_name_reports SET status = 'resolved' WHERE id = '<report-id>';
--
--   If invalid:
--     UPDATE team_name_reports SET status = 'dismissed' WHERE id = '<report-id>';

-- =====================================================
-- 1. TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS team_name_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id        TEXT NOT NULL,
  reported_user_id   TEXT NOT NULL,
  reported_team_name TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_name_reports_status
  ON team_name_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_name_reports_reported_user
  ON team_name_reports(reported_user_id);

-- One open report per reporter → target (can report again after resolve/dismiss)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_name_reports_open_pair
  ON team_name_reports (reporter_id, reported_user_id)
  WHERE status = 'open';

ALTER TABLE team_name_reports ENABLE ROW LEVEL SECURITY;

-- Default deny for clients. Access only via SECURITY DEFINER RPC.
-- Table Editor / SQL Editor (postgres) still sees all rows.

-- =====================================================
-- 2. report_team_name(target_user_id)
-- =====================================================
CREATE OR REPLACE FUNCTION report_team_name(target_user_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  uid        TEXT := auth.uid()::text;
  snap_name  TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_user_id IS NULL OR btrim(target_user_id) = '' THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  IF target_user_id = uid THEN
    RAISE EXCEPTION 'Cannot report yourself';
  END IF;

  SELECT up.team_name INTO snap_name
  FROM user_profiles up
  WHERE up.user_id = target_user_id;

  IF snap_name IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM team_name_reports r
    WHERE r.reporter_id = uid
      AND r.reported_user_id = target_user_id
      AND r.status = 'open'
  ) THEN
    RAISE EXCEPTION 'You already reported this team';
  END IF;

  INSERT INTO team_name_reports (
    reporter_id,
    reported_user_id,
    reported_team_name,
    status
  )
  VALUES (uid, target_user_id, snap_name, 'open');

  RETURN 'reported';
END;
$$;

REVOKE ALL ON FUNCTION report_team_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION report_team_name(TEXT) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'team_name_reports';
--
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name = 'report_team_name';
-- Expected: DEFINER
--
-- SELECT tablename, policyname FROM pg_policies
-- WHERE tablename = 'team_name_reports';
-- Expected: 0 rows

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP FUNCTION IF EXISTS report_team_name(TEXT);
-- DROP TABLE IF EXISTS team_name_reports CASCADE;
