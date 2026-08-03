# Handoff 6 — Server-Side GW Snapshot Fallback

---

## Goal

Fix a structural bug where users who didn't open the app during a gameweek's active window (deadline → end_date) never had their squad snapshot saved to `user_gw_picks`, causing their GW points to be permanently lost from the leaderboard.

---

## Root Cause

GW snapshots were written **entirely client-side** in `TeamContext.js`. The save only triggers when:
- `currentRound` resolves to the correct GW, AND
- `isLocked` is `true` (deadline has passed)

`fetchCurrentRound` uses this priority order:
1. **Active**: `deadline <= now AND end_date >= now`
2. **Upcoming**: `deadline > now`
3. **Fallback**: most recently completed

Once a GW's `end_date` passes, `fetchCurrentRound` moves on to the next upcoming round. If a user never opened the app during the 10-hour active window, the opportunity to save the snapshot is gone — the app has no mechanism to go back.

**Observed case:** User `360e3ba0` missed GW2's window (2026-06-19 12:00–22:00 UTC). When they opened the app, `currentRound` was already GW3 (upcoming, `isLocked = false`). Their `last_transfer_round_id` jumped directly to GW3's ID as a side-effect of the rollover logic.

---

## Fix

### Server-side: `011_server_side_gw_snapshots.sql`

Added a PostgreSQL function `snapshot_missing_gw_picks()` scheduled via **pg_cron** to run every 5 minutes.

**Logic:**
```sql
For every round where deadline <= NOW()
  For every finalized user (squad_finalized = true) with no picks for that round
    → INSERT their current user_teams into user_gw_picks
    → ON CONFLICT DO NOTHING (first write always wins — client-side saves are never overwritten)
```

This is fully **idempotent**: it becomes a no-op within seconds of the first successful save per (user, round) pair.

### Manual backfill (included in the same migration)

The affected user's current `user_teams` was inserted for GW2's `round_id`. Since `transfers_made_this_round = 0` at the time, the live team matched their GW2 squad.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/011_server_side_gw_snapshots.sql` | New — pg_cron schedule, snapshot function, GW2 backfill |

---

## No app code changes

The client-side snapshot logic in `TeamContext.js` is kept as-is. It remains the primary snapshot mechanism (fires immediately when the user opens the app during an active window). The server-side function is a **fallback only** — it only triggers for (user, round) pairs that have zero rows, so there is no conflict between the two paths.

---

## How to Run

**One-time prerequisite (do before running the migration):**
1. Supabase Dashboard → Database → Extensions → search **pg_cron** → Enable

**Then run the migration:**
1. Open Supabase Dashboard → SQL Editor → New query
2. Paste the full contents of `011_server_side_gw_snapshots.sql`
3. Run

**Verify:**
```sql
-- Cron job registered:
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'snapshot-missing-gw-picks';

-- Backfill worked for affected user (expect round 1 + round 2, 12 players each):
SELECT ugp.round_id, r.round_number, COUNT(*) AS player_count
FROM user_gw_picks ugp
JOIN rounds r ON r.id = ugp.round_id
WHERE ugp.user_id = '360e3ba0-2c51-4e2a-8099-7b038e0887cd'
GROUP BY ugp.round_id, r.round_number
ORDER BY r.round_number;
```

---

## Cron Schedule

| Schedule | Meaning |
|---|---|
| `*/5 * * * *` | Every 5 minutes, 24/7 |

The function is cheap — after the initial snapshot save for each (user, round) pair it becomes an instant no-op. With a small user base this has negligible cost and zero impact on app performance.

---

## Known Limitation: Deadlines in the Future

The `snapshot_missing_gw_picks()` function does not handle the **round rollover** (`last_transfer_round_id`, `free_transfers`). It only ensures the snapshot exists. If a user missed a GW entirely, their transfer state (free transfers, deductions) may be out of sync — that still requires a manual check for the affected user's profile.

---

## Rollback

```sql
SELECT cron.unschedule('snapshot-missing-gw-picks');
DROP FUNCTION IF EXISTS snapshot_missing_gw_picks();
```
