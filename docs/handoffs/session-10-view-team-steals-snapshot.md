# Handoff 10 — View Other Teams, Steals & Snapshot Fix

---

## Goal

Ship read-only viewing of other managers’ locked GW squads from leaderboards, add mid-season **steals** scoring, fix GW snapshot chicken-and-egg (finalize gate), harden transfer replace navigation, and polish pitch/background assets for the next Play Store build (`versionCode` 4 / `1.1.0`).

**Stack:** React Native 0.83, Expo ~55, Supabase, Android physical device (USB)

---

## Current State

Sessions 8–9 remain on stacked feature branches (not yet all on `main`):

| PR / branch | Notes |
|-------------|--------|
| `feat/private-leagues-and-profile` | Session 8 — private leagues, profile, auth |
| `feat/autosub-squad9-scoring` | Session 9 — auto-subs, squad 9, scoring 017–019 |
| **`feat/view-team-steals-snapshot`** | **This session** — cut from session 9 tip |

**New in this session:**
- **View Team** — tap eye on global / private leaderboard → read-only pitch of that user’s **locked** GW picks (not live `user_teams`)
- Migration **022** — SECURITY DEFINER RPCs for public snapshot rounds / picks / transfer deduction
- Migration **021** — `steals` on `player_match_stats`, +2 OF only; season view + admin guide
- Migration **020** — `snapshot_missing_gw_picks` no longer requires `squad_finalized` (server-finalizes on snapshot)
- `transferReplaceSession` — replace-player state survives PlayerDetail stack push
- UI: new background, red/white caps, steal icon; LeaderboardItem view button; My Team / Transfers cleanup
- Store version bump: **1.0.0 / versionCode 3 → 1.1.0 / versionCode 4**

**Branch:** `feat/view-team-steals-snapshot` (cut from `feat/autosub-squad9-scoring`)

---

## Files Changed (high level)

| Area | Files |
|------|--------|
| View Team | `screens/ViewTeamScreen.js` (**new**), `App.js` route, `LeaderboardItem.js`, Leagues / LeagueDetail |
| Public GW RPCs | `services/userGwPicksService.js` (`getPublicSnapshotRoundIds`, `getPublicGwPicksForRound`, `getPublicDeductionForRound`) |
| Migrations | `020_snapshot_without_finalized_gate.sql`, `021_steals_stat.sql`, `022_view_other_user_gw.sql` |
| Steals UI / data | `playerService.js`, `fixtureService.js`, `PlayerDetailScreen.js`, `PlayersScreen.js`, `fixtures-admin-guide.md` |
| Transfers | `utils/transferReplaceSession.js`, `TransfersScreen.js`, `PlayersScreen.js` |
| Pitch / cards | `PitchView.js`, `PlayerCard.js`, `MyTeamScreen.js`, `GWHistoryScreen.js` |
| Assets | `icons.js`, `NewBackground.png`, `redcap2.png`, `whitecap2.png`, `steal.png` |
| Version | `app.json`, `android/app/build.gradle` |

---

## View Other Teams — How It Works

### Privacy model

- **Locked only:** clients call RPCs that read `user_gw_picks` (+ `user_round_deductions`). Live `user_teams` stay private.
- Authenticated users only (`auth.uid()` required inside each SECURITY DEFINER function).
- Score uses the same client auto-sub path as own history (`scorePicksWithAutoSub`).

### Client flow

1. Leaderboard row → `onViewTeam` → navigate `ViewTeam` with `{ userId, teamName }`
2. `get_user_snapshot_rounds` → intersect with `fetchAllRounds` → GW tabs for rounds that have snapshots
3. Per GW: picks + deduction RPCs → hydrate players → score with auto-sub → `PitchView` read-only

### SQL (migration 022)

| RPC | Returns |
|-----|---------|
| `get_user_snapshot_rounds(target_user_id)` | Distinct `round_id`s in `user_gw_picks` |
| `get_user_gw_picks_for_round(user, round)` | `player_id`, starter/captain, `position_order` |
| `get_user_round_deduction(user, round)` | Integer deduction (0 if none) |

---

## Snapshot Fix (migration 020)

**Bug:** `snapshot_missing_gw_picks` only copied users with `squad_finalized = true`, but finalization is mostly client-side after deadline. Users who never reopened the app after lock (especially first GW) got **no** `user_gw_picks` rows → invisible to scoring / View Team.

**Fix:** Snapshot any user with `user_teams` rows for locked rounds in the active window; server-set finalize so transfer state stays consistent; cron schedule re-affirmed.

---

## Steals (migration 021)

Mid-season safe: column `DEFAULT 0`; does **not** recompute historical match points.

| Who | Points |
|-----|--------|
| Outfield | +2 per steal |
| GK | no steal points |

Season view exposes `total_steals`. Player detail + admin fixtures guide updated. See scoring tables in session 9 handoff + `docs/features/fixtures-admin-guide.md` (as of 021).

---

## Transfer Replace Session

Module-level session (`startReplaceSession` / `getReplaceSession` / `clearReplaceSession`) so SELECT REPLACEMENT survives navigating to Player Detail and back without losing the outgoing player.

---

## Migrations — How to Run

Run **in order** in Supabase Dashboard → SQL Editor (after 017–019 from session 9):

1. `020_snapshot_without_finalized_gate.sql`
2. `021_steals_stat.sql`
3. `022_view_other_user_gw.sql`

### Quick verify

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'player_match_stats' AND column_name = 'steals';

SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'snapshot_missing_gw_picks',
    'get_user_snapshot_rounds',
    'get_user_gw_picks_for_round',
    'get_user_round_deduction'
  );
```

---

## Play Store note

This branch bumps Android/iOS marketing version to **1.1.0** and Android **versionCode 4**. Build a signed release AAB from this commit after migrations 020–022 are on prod.

---

## Known Limitations / Follow-ups

- View Team only works for rounds that already have `user_gw_picks` (post-deadline snapshot). Pre-deadline live squads are not visible.
- Stack of feature PRs still needs merge path to `main` (8 → 9 → 10).
- Unused asset left untracked locally if present: `Cinematic Blue Stadium Reflections.png` (app uses `NewBackground.png`).
- Confirm 020 cron is active in prod after paste-run.

---

## Quick Smoke Test

1. Migrations 020→022 applied on the project the app hits.
2. After a locked GW, open Leagues → eye on another manager → pitch + GW score + deduction look right; switch GW tabs.
3. Own row / private league detail view button also opens View Team.
4. Admin: enter OF `steals` → match points +2 each; GK steals do not add; player detail shows STEALS.
5. Transfers: start replace → open player detail → back → still in replace mode with correct outgoing player.
6. Background / caps / steal icon render; build with versionCode 4.
