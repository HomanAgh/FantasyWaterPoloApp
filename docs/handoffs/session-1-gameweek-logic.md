# Handoff — Fantasy Water Polo App

---

## Goal

Build a mobile Fantasy Premier League clone for water polo. Users pick a squad of 12 players (2 GK + 10 outfield, 7 starters + 5 subs), set a captain, and earn points based on real match performance. The rules mirror FPL exactly:

- Unlimited transfers before GW1 deadline. 1 free transfer per gameweek after that, capped at 2 banked.
- Extra transfers cost -4 points each.
- A team "snapshot" is locked at the GW deadline — post-deadline transfers must not change past scores.
- Points accumulate across all gameweeks into a total shown on a global leaderboard.

**Stack:** React Native (Expo), Supabase (PostgreSQL), anonymous auth via anon key.

---

## Current State

The core FPL gameplay loop is working and tested:

- Squad selection, captain picking, budget tracking — working.
- GW deadline locking (transfers disabled after deadline) — working.
- Snapshot saves to `user_gw_picks` at deadline — working.
- GW points calculated from snapshot (frozen, unaffected by transfers) — working.
- Transfer deductions (-4 per extra) persist across reloads — working.
- Total points and leaderboard (`global_leaderboard` view) — working.
- Rollover (new GW → +1 free transfer, reset deductions) fires exactly once — working after race condition fix.
- App reload no longer corrupts free transfer count or deductions — working after DB-authoritative fix.

**Currently between GW3 (completed) and GW4 (not yet created).** The app shows GW3 as the most recently completed round. Transfers are locked. No active round is running.

**Latest branch pushed to GitHub:** `feature/fpl-gameweek-logic`

---

## Files in Flight

These are the files that matter most and are most likely to need future changes:

| File | Role |
|------|------|
| `context/TeamContext.js` | Central brain — team state, transfer logic, snapshot saving, point calculation, round transition handling |
| `context/RoundContext.js` | Fetches current round every 60s, exposes `currentRound`, `isLocked`, deadline formatting |
| `services/transferService.js` | `getTransferState`, `recordTransfer`, `processRoundRollover`, `finalizeSquad` |
| `services/userGwPicksService.js` | `saveGwSnapshot`, `calculateLockedGwScore`, `calculateTotalLockedPoints` |
| `services/roundService.js` | `fetchCurrentRound` (3-query fallback logic), `isRoundLocked` |
| `services/leagueService.js` | `fetchGlobalLeaderboard`, `getUserGlobalRank`, `getLeaderboardAroundUser` |
| `screens/HomeScreen.js` | Displays GW live points, total points, fixtures, team summary |
| `screens/TransfersScreen.js` | Player swap UI, shows free transfers remaining, deduction warnings |
| `screens/MyTeamScreen.js` | Pitch view, captain selection, starter/sub toggling |

---

## Database Schema

All migrations live in `supabase/migrations/` and are numbered in run order. The `supabase/setup.sql` file is the base schema (run first, not numbered). As of this session all migration files accurately reflect the live DB.

| File | What it creates / changes |
|------|--------------------------|
| `setup.sql` | Base tables: `teams`, `players`, `user_teams`, `transfers`, `rounds` |
| `002_gameweek_features.sql` | `player_round_points` table; `is_captain` on `user_teams`; `status` + `deadline` on `rounds` |
| `003_user_profiles.sql` | `user_profiles` table (base: `user_id`, `team_name`) |
| `004_fixtures_and_match_stats.sql` | `fixtures` table; `player_match_stats` table (incl. `penalty_saves`, `appeared`, `clean_sheet`) |
| `005_player_stats_cards_and_clean_sheet.sql` | `calculate_player_match_points` function; auto-scoring trigger on `player_match_stats` |
| `006_user_gw_picks.sql` | `user_gw_picks` table — frozen squad snapshots at each deadline |
| `007_transfer_deductions_and_leaderboard.sql` | Adds transfer-state columns to `user_profiles`; `user_round_deductions` table; `global_leaderboard` view; `get_user_global_rank` RPC |

**Important — RLS and anon key:** The app uses Supabase's anon key. This means `auth.role()` returns `'anon'`, not `'authenticated'`. All write policies use `USING (true)` rather than `auth.role() = 'authenticated'`. Any new table must follow this pattern.

---

## What's Been Changed

### `context/TeamContext.js`
- `handleRoundTransition` now reads `squad_finalized` and `last_transfer_round_id` **directly from the DB** at the start of every run instead of trusting local React state. This was the critical fix for the reload bug.
- `squadFinalized` and `lastTransferRoundId` removed from the effect dependency array (was `[userId, currentRound?.id, isLocked, squadFinalized, lastTransferRoundId]`, now `[userId, currentRound?.id, isLocked]`).
- Added snapshot safety-net `useEffect` watching `[selectedPlayers, isLocked, currentRound?.id, userId]` — re-saves snapshot once players finish loading, covering the race where the main effect fired before `loadUserTeam` completed.
- `calculateGameweekPoints` branches on `isLocked`: locked rounds use `calculateLockedGwScore` (snapshot), open rounds use live `selectedPlayers`.
- Guard added before `finalizeSquad`: checks `userProfileService.getUserProfile` exists first — prevents PGRST116 crash for users mid-registration.
- `recordTransfer` call now passes `currentRound?.id`.

### `services/transferService.js` (new file, previously untracked)
- `recordTransfer` accepts `roundId` and upserts paid deductions into `user_round_deductions` table for permanent storage.
- `processRoundRollover` reads `free_transfers` from DB directly before calculating new value (avoids stale closure).

### `services/roundService.js`
- `fetchCurrentRound` has a third fallback query: if no active or upcoming round exists, returns the most recently completed round. Prevents the app losing context between gameweeks.

### `screens/HomeScreen.js`
- `overallTotalPoints` is now simply `lockedTotalPoints` (from `global_leaderboard` view via DB). Previously was `lockedTotalPoints + gameweekPoints`, which double-counted the current GW.

### Database (manual SQL run in Supabase)
- Created `user_round_deductions` table: `(user_id, round_id, deduction)` with RLS `FOR ALL USING (true)`.
- Rewrote `global_leaderboard` view to join `user_gw_picks` + `player_round_points` (matched by `round_id`) and subtract `SUM(user_round_deductions.deduction)` from total points.
- Fixed RLS policies on `user_gw_picks` and `player_round_points` from `auth.role() = 'authenticated'` to `USING (true)` — app uses anon key so `auth.role()` returns `'anon'`, not `'authenticated'`.

---

## Failed Attempts

### `upsert` in `transferService.finalizeSquad` and `processRoundRollover`
- **What happened:** Changed `.update().single()` to `.upsert()` to handle users without a profile row.
- **Why it failed:** The upsert silently created a row with default values (`team_name = 'My Team'`) before the user completed onboarding. The user saw their team auto-named instead of being prompted.
- **Fix:** Reverted to `.update()`. Added a profile existence guard (`getUserProfile`) before `finalizeSquad` is called.

### Trusting local React state in `handleRoundTransition`
- **What happened:** The effect used `squadFinalized` and `lastTransferRoundId` from local state for its branching logic.
- **Why it failed:** On every app reload, both values start as their initial defaults (`false` and `null`) before `loadTransferState` runs. The effect fires the moment `userId` is set — before the DB values are loaded. This caused `finalizeSquad` to run on every reload (resetting `free_transfers` to 1) and sometimes `processRoundRollover` to fire spuriously too.
- **Fix:** Read both values from the DB at the top of `handleRoundTransition` before any branching.

### Including `squadFinalized`/`lastTransferRoundId` in the effect dependency array
- **What happened:** They were in `[userId, currentRound?.id, isLocked, squadFinalized, lastTransferRoundId]`.
- **Why it failed:** When `loadTransferState` set these values from DB, it triggered another effect run. Combined with the stale-state issue above, this created timing windows where rollover could fire twice or finalize could run again.
- **Fix:** Removed both from deps. DB reads inside the handler make them unnecessary as triggers.

### `overallTotalPoints = lockedTotalPoints + gameweekPoints`
- **What happened:** HomeScreen added both together to get the "total".
- **Why it failed:** `lockedTotalPoints` comes from `global_leaderboard` which already includes the current GW's score. Adding `gameweekPoints` (also the current GW) doubled it. User saw 104 instead of 52.
- **Fix:** `overallTotalPoints = lockedTotalPoints` directly.

### Storing deductions only in `user_profiles.pending_deductions`
- **What happened:** Deductions were tracked in `pending_deductions` column only.
- **Why it failed:** `processRoundRollover` resets `pending_deductions = 0` at the start of each new GW. Any paid transfer deductions from the previous GW disappeared from the total. The leaderboard never subtracted them.
- **Fix:** Created permanent `user_round_deductions` table. Each paid transfer writes the cumulative deduction there. `global_leaderboard` subtracts the sum.

---

## Next Steps

**Create GW4 in the database to resume live testing:**

```sql
INSERT INTO rounds (round_number, status, deadline, start_date, end_date)
VALUES (
  4,
  'upcoming',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '8 days'
);
```

This will trigger the rollover on app reload — the app will detect `currentRound.id (GW4) !== last_transfer_round_id (GW3)` and award +1 free transfer correctly. From there you can test adding GW4 player stats and verify total points accumulate properly across GW3 + GW4.

**If setting up a fresh Supabase project**, run all SQL files in this order:
1. `supabase/setup.sql`
2. `supabase/migrations/002_gameweek_features.sql`
3. `supabase/migrations/003_user_profiles.sql`
4. `supabase/migrations/004_fixtures_and_match_stats.sql`
5. `supabase/migrations/005_player_stats_cards_and_clean_sheet.sql`
6. `supabase/migrations/006_user_gw_picks.sql`
7. `supabase/migrations/007_transfer_deductions_and_leaderboard.sql`
