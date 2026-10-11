-- Migration: View other users' locked GW squads
-- Description: SECURITY DEFINER RPCs so authenticated clients can read another
--              user's deadline snapshots (user_gw_picks + deductions) without
--              opening RLS on those tables. Live user_teams stay private.
-- Created: 2026-10-11

-- =====================================================
-- 1. get_user_snapshot_rounds(target_user_id)
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_snapshot_rounds(target_user_id TEXT)
RETURNS TABLE (round_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_user_id IS NULL OR btrim(target_user_id) = '' THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ugp.round_id
  FROM user_gw_picks ugp
  WHERE ugp.user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION get_user_snapshot_rounds(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_snapshot_rounds(TEXT) TO authenticated;

-- =====================================================
-- 2. get_user_gw_picks_for_round(target_user_id, target_round_id)
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_gw_picks_for_round(
  target_user_id  TEXT,
  target_round_id UUID
)
RETURNS TABLE (
  player_id      UUID,
  is_starter     BOOLEAN,
  is_captain     BOOLEAN,
  position_order INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_user_id IS NULL OR btrim(target_user_id) = '' THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  IF target_round_id IS NULL THEN
    RAISE EXCEPTION 'Invalid round';
  END IF;

  RETURN QUERY
  SELECT
    ugp.player_id,
    ugp.is_starter,
    ugp.is_captain,
    ugp.position_order
  FROM user_gw_picks ugp
  WHERE ugp.user_id = target_user_id
    AND ugp.round_id = target_round_id;
END;
$$;

REVOKE ALL ON FUNCTION get_user_gw_picks_for_round(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_gw_picks_for_round(TEXT, UUID) TO authenticated;

-- =====================================================
-- 3. get_user_round_deduction(target_user_id, target_round_id)
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_round_deduction(
  target_user_id  TEXT,
  target_round_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deduction INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_user_id IS NULL OR btrim(target_user_id) = '' THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  IF target_round_id IS NULL THEN
    RAISE EXCEPTION 'Invalid round';
  END IF;

  SELECT urd.deduction INTO v_deduction
  FROM user_round_deductions urd
  WHERE urd.user_id = target_user_id
    AND urd.round_id = target_round_id;

  RETURN COALESCE(v_deduction, 0);
END;
$$;

REVOKE ALL ON FUNCTION get_user_round_deduction(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_round_deduction(TEXT, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'get_user_snapshot_rounds',
--     'get_user_gw_picks_for_round',
--     'get_user_round_deduction'
--   );
--
-- SELECT * FROM get_user_snapshot_rounds('<user-id>');
-- SELECT * FROM get_user_gw_picks_for_round('<user-id>', '<round-id>');
-- SELECT get_user_round_deduction('<user-id>', '<round-id>');

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP FUNCTION IF EXISTS get_user_snapshot_rounds(TEXT);
-- DROP FUNCTION IF EXISTS get_user_gw_picks_for_round(TEXT, UUID);
-- DROP FUNCTION IF EXISTS get_user_round_deduction(TEXT, UUID);
