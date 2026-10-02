# Handoff 9 — Auto-Subs, 9-Player Squad & Scoring Overhaul

---

## Goal

Ship FPL-style auto-substitution (never previously wired), shrink squads from 12 → 9 (7 starters + 1 GK bench + 1 OF bench), overhaul match scoring (position-gated points, fouls drawn, drop yellow/minutes), and polish UI for Play Store / GW1 (Oct 6). Also add delete-account (RPC + Edge Function).

**Stack:** React Native 0.83, Expo ~55, Supabase, Android physical device (USB)

---

## Current State

Session 8 (private leagues / profile / auth) remains on `feat/private-leagues-and-profile` as **PR #2** (not yet merged to `main`). This session stacks on top of that branch.

**New in this session:**
- Squad size **9** = 7 starters (1 GK + 6 OF) + 2 bench (1 GK + 1 OF)
- Auto-sub at **score time** (does not rewrite `player_round_points`)
- Migration **018** — `position_order` on snapshots + `score_user_round_with_autosub` + leaderboards
- Migration **019** — `fouls_drawn`, position-gated scoring, drop yellow/minutes; season view updated
- Migration **017** — `delete_my_account_data` + Edge Function `delete-account`
- UI: captain ×2 on pitch cards, leagues split layout, player detail FOULS DRAWN / PEN SAVE icons
- Verified auto-sub on GW99 test squad: without = 14, with = 20

**Branch:** `feat/autosub-squad9-scoring` (cut from `feat/private-leagues-and-profile`)

**PRs:**
| PR | Branch | Base | Status |
|----|--------|------|--------|
| [#2](https://github.com/HomanAgh/FantasyWaterPoloApp/pull/2) | `feat/private-leagues-and-profile` | `main` | Open — merge first |
| [#3](https://github.com/HomanAgh/FantasyWaterPoloApp/pull/3) | `feat/autosub-squad9-scoring` | `feat/private-leagues-and-profile` | Open — merge after #2 (retarget to `main` if needed) |

---

## Files Changed (high level)

| Area | Files |
|------|--------|
| Auto-sub | `services/autoSubstitutionService.js`, `services/userGwPicksService.js`, `context/TeamContext.js` |
| Squad limits | `TeamContext.js`, `components/PitchView.js`, MyTeam / Transfers / Players / Home / GWHistory |
| Scoring UI | `components/PlayerCard.js` (captain ×2), `screens/PlayerDetailScreen.js`, `services/playerService.js` |
| Leagues UI | `screens/LeaguesScreen.js` (join/create card → PRIVATE LEAGUES → global board) |
| Migrations | `017_delete_account.sql`, `018_autosub_and_squad_size.sql`, `019_scoring_overhaul_fouls_drawn.sql` |
| Delete account | `supabase/functions/delete-account/index.js`, Profile screen wiring |
| Icons | `assets/images/icons.js` + many PNGs (`whistle`, `penaltysave`, etc.) |
| Docs | `docs/features/fixtures-admin-guide.md` (019 scoring tables) |

---

## Auto-Sub — How It Works

### Rules

- Only **blank starters** (`appeared !== true`) are eligible for a sub
- Position match: GK ↔ GK, Outfield ↔ Outfield
- Bench priority = `position_order` ascending
- Each bench player used at most once
- Captain ×2 applies to the **original captain’s starter slot** (even if a sub fills it)
- No eligible sub → that slot scores **0**
- Never writes to `player_round_points` — computed per user at score time

### Client

```js
// services/autoSubstitutionService.js
resolveSquadPointsWithAutoSub(picks, appearanceMap, pointsMap)
fetchAppearanceMap(playerIds, roundId)  // from player_match_stats + fixtures.round_id
```

Wired in:
- Live GW points — `TeamContext`
- Locked / history — `scorePicksWithAutoSub` in `userGwPicksService`
- MyTeam + GWHistory show **SUB** / **IN** badges

### SQL (migration 018)

`score_user_round_with_autosub(user_id, round_id)` mirrors the JS rules. Global + private league leaderboards call it so board totals include auto-subs.

**Note:** Live `global_leaderboard` view may have extra columns vs an older `CREATE OR REPLACE VIEW` — if you re-run 018, prefer the prod-safe path (DROP CASCADE + recreate 7-col shape) documented in the migration comments / prior session fixes.

`get_user_global_rank` needed `#variable_conflict use_column` + qualified `pts` alias to avoid ambiguous `total_points`.

---

## Squad Size 9

| Role | Count |
|------|-------|
| Starters | 7 (1 GK + 6 Outfield) |
| Bench | 2 (1 GK + 1 Outfield) |
| **Total** | **9** |

`position_order`: starters 1–7, bench GK = 8, bench OF = 9. Snapshots store `position_order` for auto-sub bench priority.

**Edge cases (confirmed):**
- All blank starters + blank bench → **0**
- One OF blank + one OF bench who appeared → sub covers **one** blank only

---

## Scoring (migration 019)

### Outfield

| Stat | Points |
|------|--------|
| Goal | +5 |
| Assist | +3 |
| Appearance | +1 |
| Block | +2 |
| Sprint | +2 |
| Fouls drawn | +2 |
| Clean sheet (per period) | +1 |
| Red | −10 |

No yellow, no minutes. No saves / penalty saves.

### Goalkeeper

| Stat | Points |
|------|--------|
| Goal | +5 |
| Assist | +3 |
| Save | +1 each |
| Penalty save | +5 each |
| Appearance | +1 |
| Fouls drawn | +2 |
| Clean sheet (per period) | +10 |
| Red | −10 |

No blocks / sprints. No yellow / minutes.

Admin: insert into `player_match_stats` including `fouls_drawn` / `penalty_saves`; **do not** set `points_earned` (trigger). Then upsert `player_round_points` for GW totals as usual. See `docs/features/fixtures-admin-guide.md`.

Verified after 019 recompute: sample GK **41**, sample OF **12**.

---

## Migrations — How to Run

Run **in order** in Supabase Dashboard → SQL Editor (after session 8’s 013–016 if not already applied):

1. `017_delete_account.sql` — `delete_my_account_data()`; then deploy Edge Function:
   ```bash
   supabase functions deploy delete-account
   ```
2. `018_autosub_and_squad_size.sql` — `position_order`, auto-sub scorer, leaderboard updates
3. `019_scoring_overhaul_fouls_drawn.sql` — column + scoring function + season view + recompute

### Quick verify

```sql
SELECT proname FROM pg_proc
WHERE proname IN (
  'score_user_round_with_autosub',
  'calculate_player_match_points',
  'delete_my_account_data'
);

SELECT column_name FROM information_schema.columns
WHERE table_name = 'player_match_stats'
  AND column_name IN ('fouls_drawn', 'penalty_saves');
```

---

## Play Store / GW1 note

An older **12-player** build may still be on Play while review catches up. That build remains playable against the live DB until users update — but after 018/019, **new clients expect 9-player squads and new scoring**. Prefer shipping the 9-player build before GW1 deadline (Oct 6) if possible.

---

## Known Limitations / Follow-ups

- Session 8 PR #2 must merge before #3 lands on `main` cleanly
- Old 12-player `user_teams` / snapshots may need wipe or migration for testers moving to 9
- Auto-sub depends on correct `appeared` flags and `position_order` on snapshots
- Delete-account Edge Function must be deployed for Profile delete to fully remove `auth.users`
- Optional: write a short session-8 merge checklist once #2 is green

---

## Quick Smoke Test

1. Migrations 017→019 applied; delete-account function deployed (optional for scoring smoke).
2. Finalize a 9-player squad (1+6 starters, 1 GK + 1 OF bench).
3. Seed/blank a starter who did not appear; put points on the OF bench who did → GW total includes sub.
4. My Team / GW History show SUB / IN when applicable.
5. Enter GK stats with `penalty_saves` + OF with `fouls_drawn` → points match tables above.
6. Player detail: FOULS DRAWN (whistle), PEN SAVE (`penaltysave` icon) for GKs.
7. Captain starter shows doubled points on pitch card.
8. Leagues screen: create/join card separate from PRIVATE LEAGUES list and global board.
