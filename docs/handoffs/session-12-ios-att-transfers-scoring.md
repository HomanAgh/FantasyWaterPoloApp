# Handoff 12 — iOS ATT/AdMob, 3 Free Transfers, GK Steals & UI Polish

---

## Goal

Ship iOS ads readiness (App Tracking Transparency + production AdMob), raise the free-transfer bank from 2 to 3, fix season `games_played` and give goalkeepers steal points, and polish phone-first layouts for iPad/TestFlight. Android store version stays **1.1.2 / versionCode 6**; iOS **buildNumber** is **7**.

**Stack:** React Native 0.83, Expo ~55, Supabase, Android USB + iOS (EAS / TestFlight)

---

## Current State

Sessions 8–11 remain stacked and not all on `main`:

| PR / branch | Notes |
|-------------|--------|
| [#2](https://github.com/HomanAgh/FantasyWaterPoloApp/pull/2) `feat/private-leagues-and-profile` | Session 8 — open, base `main` |
| [#3](https://github.com/HomanAgh/FantasyWaterPoloApp/pull/3) `feat/autosub-squad9-scoring` | Session 9 — open, base session 8 |
| `feat/view-team-steals-snapshot` | Session 10 — pushed, **no PR** |
| `feat/rewarded-ads-league-start` @ `d16aaa8` | Session 11 — rewarded ads, scout gate, league start |
| **`feat/rewarded-ads-league-start` (this commit)** | **This session** — continues on the same branch |

**New in this session:**
- iOS ATT via `expo-tracking-transparency` after UMP, before Mobile Ads init; NPA when ATT not granted
- Production iOS AdMob app id + rewarded unit; GMA + ATT Expo plugins in `app.json`
- Register Expo root `"main"` in `index.js` (fixes iOS blank launch)
- `scripts/eas-push-env.ps1` — push Supabase/Sentry into EAS env for cloud builds
- Free-transfer bank **MAX 2 → 3**; finalize and GW rollover top up to 3
- Migration **025** — `games_played` counts only `appeared = true`
- Migration **026** — steals +2 for GK and Outfield (forward-only)
- Golden-ball title hero; `layout` max-widths; iOS Dynamic Type cap; Players iOS filter chips; league/player UI polish
- iOS `buildNumber` **5 → 7** (Android still **6 / 1.1.2**)

**Branch:** `feat/rewarded-ads-league-start` (same as session 11)

---

## Files Changed (high level)

| Area | Files |
|------|--------|
| ATT / ads | `services/attService.js` (**new**), `services/adsService.js`, `config/adsConfig.js`, `App.js`, `app.json`, `package.json` |
| iOS launch / EAS | `index.js`, `scripts/eas-push-env.ps1` |
| Free transfers (3) | `services/transferService.js`, `context/TeamContext.js` |
| Scoring / stats | `025_games_played_appeared_only.sql`, `026_gk_steals_scoring.sql`, `services/playerService.js`, `docs/features/fixtures-admin-guide.md` |
| Brand / layout | `assets/images/goldenball.png`, `assets/images/icons.js`, `styles/theme.js`, Auth / Home / most screens |
| League / player UI | `screens/LeaguesScreen.js`, `screens/LeagueDetailScreen.js`, `screens/PlayerDetailScreen.js`, `screens/PlayersScreen.js` |
| Deadline display | `services/roundService.js` (`formatDeadline` always date/time) |

---

## ATT + iOS ads

1. Fonts load → `startAdsIfAllowed`.
2. UMP consent (unchanged from session 11).
3. **iOS:** `ensureTrackingPermission` (lazy-require so Android never loads the native module).
4. Mobile Ads init + rewarded preload only when `canRequestAds`.
5. Rewarded requests use `requestNonPersonalizedAdsOnly: true` on iOS unless ATT status is `granted`. Android keeps NPA false (UMP alone).

- `__DEV__` still uses `TestIds.REWARDED`.
- Release uses platform-specific production units in `config/adsConfig.js`.
- Native rebuild required after ATT plugin / iOS AdMob app id changes.
- Before EAS cloud builds: run `.\scripts\eas-push-env.ps1` once (gitignored Supabase/Sentry configs → EAS env).

---

## Free transfers (max 3)

`MAX_FREE_TRANSFERS` is **3**. Squad finalize sets `free_transfers = 3` and `unlocked_free_transfers = 0`. GW rollover sets the bank to `min(current + 3, 3)` (always tops up to 3) and resets unlocked count.

Ad unlock flow from session 11 is unchanged: banked transfers still need unlock via rewarded ad before they spend without a hit.

---

## Migrations — How to Run

After 023–024, in Supabase Dashboard → SQL Editor:

1. `025_games_played_appeared_only.sql`
2. `026_gk_steals_scoring.sql`

### Quick verify

```sql
-- 025: games_played ignores DNP rows
SELECT definition FROM pg_views WHERE viewname = 'player_season_stats';
-- expect FILTER (WHERE pms.appeared = true)

-- 026: steals shared for GK + OF
SELECT calculate_player_match_points(0, 0, 0, 0, true, 0, 0, 'GK', 0, 0, 0, 1);
-- expect 3 (appearance + 1 steal)
```

026 does **not** recompute existing `player_match_stats.points_earned` or round totals — forward-only for new inserts/updates.

---

## Store / build note

| Platform | Version |
|----------|---------|
| Android | **1.1.2 / versionCode 6** (unchanged this session) |
| iOS | **buildNumber 7** |

This cycle is oriented at TestFlight / iOS. Bump Android when cutting the next Play AAB.

---

## Known limitations

- Free-transfer unlock and scout gate remain client-enforced (session 11).
- Migration 026 does not backfill historical match points for GK steals already entered.
- PR stack to `main` is still #2 → #3 → session 10 (no PR) → this branch.
- Unused local asset `assets/images/newicon.png` was left uncommitted.

---

## Quick smoke test

1. Migrations 025 and 026 applied (after 023–024).
2. Fresh iOS install: UMP (if needed) → ATT prompt → ads can load; denied ATT still serves NPA ads.
3. Profile → TEST REWARDED AD (dev) shows a sample ad on both platforms.
4. After finalize / GW rollover, banked free transfers show **3**; unlock-via-ad still required to spend without a hit.
5. New fixture with GK steals: points include +2 per steal; Player Detail shows STL for GK.
6. Player with DNP rows (`appeared = false`): season games played does not count those rows.
7. Auth/Home show golden-ball title; iPad widths stay capped; Players position chips readable on iOS.
