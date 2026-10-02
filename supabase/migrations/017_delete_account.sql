-- Migration: Delete Account
-- Description: SECURITY DEFINER RPC that wipes all app data for the caller.
--              Auth user deletion (auth.users) is handled by the delete-account
--              Edge Function after this RPC succeeds — clients cannot call
--              admin.deleteUser with the anon key.
-- Created: 2026-08-24
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--   Then deploy the Edge Function: supabase/functions/delete-account
--
-- WHAT IT DELETES (caller only, via auth.uid()):
--   transfers, user_gw_picks, user_round_deductions, user_teams,
--   team_name_reports (as reporter or reported), league membership,
--   leagues they solely own (or reassigns admin then leaves), user_profiles.

-- =====================================================
-- delete_my_account_data()
-- =====================================================
CREATE OR REPLACE FUNCTION delete_my_account_data()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  uid            TEXT := auth.uid()::text;
  league_rec     RECORD;
  new_admin_id   TEXT;
  remaining      BIGINT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Gameplay / squad data
  DELETE FROM transfers
  WHERE user_id = uid;

  DELETE FROM user_gw_picks
  WHERE user_id = uid;

  DELETE FROM user_round_deductions
  WHERE user_id = uid;

  DELETE FROM user_teams
  WHERE user_id = uid;

  -- Moderation rows that reference this user
  DELETE FROM team_name_reports
  WHERE reporter_id = uid
     OR reported_user_id = uid;

  -- Private leagues: leave every membership; reassign or delete owned leagues
  FOR league_rec IN
    SELECT l.id, l.created_by
    FROM leagues l
    INNER JOIN league_members lm ON lm.league_id = l.id
    WHERE lm.user_id = uid
  LOOP
    IF league_rec.created_by = uid THEN
      SELECT COUNT(*) INTO remaining
      FROM league_members lm
      WHERE lm.league_id = league_rec.id
        AND lm.user_id <> uid;

      IF remaining = 0 THEN
        -- Sole member — drop the league (CASCADE removes membership)
        DELETE FROM leagues WHERE id = league_rec.id;
      ELSE
        -- Hand admin to the earliest remaining member, then leave
        SELECT lm.user_id INTO new_admin_id
        FROM league_members lm
        WHERE lm.league_id = league_rec.id
          AND lm.user_id <> uid
        ORDER BY lm.joined_at ASC
        LIMIT 1;

        UPDATE leagues
        SET created_by = new_admin_id
        WHERE id = league_rec.id;

        DELETE FROM league_members
        WHERE league_id = league_rec.id
          AND user_id = uid;
      END IF;
    ELSE
      DELETE FROM league_members
      WHERE league_id = league_rec.id
        AND user_id = uid;
    END IF;
  END LOOP;

  -- Profile last (team name / transfer state)
  DELETE FROM user_profiles
  WHERE user_id = uid;

  RETURN 'deleted';
END;
$$;

REVOKE ALL ON FUNCTION delete_my_account_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_my_account_data() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_my_account_data() TO service_role;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'delete_my_account_data';
-- Expected: DEFINER
--
-- Rollback:
-- DROP FUNCTION IF EXISTS delete_my_account_data();
