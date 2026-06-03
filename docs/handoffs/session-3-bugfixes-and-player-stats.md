# Handoff 3 — Bug Fixes, Player Stats & Dev Environment

---

## Goal

Fix persistent black screen issues that blocked development, improve player statistics (blocks, sprints, season stats view), and clean up the documentation structure.

**Stack:** React Native 0.83, Supabase, Android Emulator (Windows)

---

## Current State

All previous features (auth, squad, transfers, points, leaderboard, fixtures, leagues) remain intact.

**New in this session:**
- Black screen on Android emulator is resolved — root causes identified and fixed in code
- Player stats enhanced with blocks and sprints tracking
- Season stats SQL view added for aggregated player performance
- All old root-level markdown docs moved into `docs/` folder structure
- Dev environment workflow documented

**Latest branch pushed to GitHub:** `fix/babel-dark-mode-player-stats`

**Previous branch:** `feature/supabase-auth`

---

## Files Changed

| File | Change |
|------|--------|
| `App.js` | Added `theme={DefaultTheme}` to `NavigationContainer` + `SafeAreaProvider` wrapper |
| `babel.config.js` | Changed preset from `@react-native/babel-preset` to `babel-preset-expo` |
| `screens/PlayersScreen.js` | Updated to show blocks and sprints stats |
| `screens/PlayerDetailScreen.js` | Updated to display full player stat breakdown |
| `services/playerService.js` | Updated queries to include blocks/sprints fields |
| `services/fixtureService.js` | Improvements to fixture data fetching |
| `supabase/setup.sql` | Updated base schema |
| `supabase/migrations/002_gameweek_features.sql` | Updated |
| `supabase/migrations/004_fixtures_and_match_stats.sql` | Updated |
| `supabase/migrations/009_blocks_sprints_and_scoring_update.sql` | **New.** Adds blocks and sprints columns to player stats |
| `supabase/migrations/010_player_season_stats_view.sql` | **New.** Aggregated view of player stats across all rounds |
| `docs/` | **New folder.** All documentation moved here from root level |

---

## Bug Fixes Applied

### 1. Black screen — Android Dark Mode

`NavigationContainer` inherits the system colour scheme by default. When the Android emulator was in dark mode, the entire app appeared black even though JS was running correctly.

**Fix:** Force light theme permanently:
```js
// App.js
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
<NavigationContainer theme={DefaultTheme}>
```

**Emergency recovery if dark mode causes black screen:**
```bash
adb shell cmd uimode night no
# or force light mode:
adb shell settings put secure ui_night_mode 1
```

### 2. Black screen — Wrong Babel Preset

`babel.config.js` was using `@react-native/babel-preset` instead of `babel-preset-expo`. This meant Expo modules (`expo-secure-store`, etc.) were not correctly transformed — the `EXPO_OS` global was never injected, causing SecureStore to malfunction during Supabase session restoration. In the New Architecture (Fabric), errors from this were silently swallowed.

**Fix:**
```js
// babel.config.js
module.exports = {
  presets: ['babel-preset-expo'],
};
```

### 3. Black screen — Missing `SafeAreaProvider`

`useSafeAreaInsets()` was called in `MainTabs` without a `<SafeAreaProvider>` wrapper. In `react-native-safe-area-context` v5+ this throws silently in Fabric.

**Fix:** Root `App` component now wraps everything in `<SafeAreaProvider>`.

---

## Database Changes

### Migration 009 — Blocks, Sprints & Scoring Update
File: `supabase/migrations/009_blocks_sprints_and_scoring_update.sql`

Adds `blocks` and `sprints` columns to player round points table and updates the scoring logic to include them.

Run in Supabase SQL Editor.

### Migration 010 — Player Season Stats View
File: `supabase/migrations/010_player_season_stats_view.sql`

Creates a view that aggregates all player stats (goals, assists, saves, blocks, sprints, etc.) across all rounds for season-long totals. Used by `PlayersScreen` and `PlayerDetailScreen`.

Run in Supabase SQL Editor after migration 009.

---

## Dev Environment Workflow (Established This Session)

See `docs/dev-setup/emulator-startup.md` for the full guide.

**Summary:**
1. Start emulator from Android Studio Device Manager
2. `adb reverse tcp:8081 tcp:8081`
3. `npm start`
4. Tap app icon on emulator screen — **never use Android Studio's Run ▶ button** for normal dev
5. Press `r` in Metro terminal to reload after code changes
6. In Dev Menu (`d`): keep **Fast Refresh OFF** to prevent black screen when backgrounding app

**Only use `npx react-native run-android --no-packager`** when you need to reinstall the APK (after `npm install` of a native package or after wiping emulator data).

---

## Known Issues / Warnings

### Metro config warning
```
From React Native 0.73, your project's Metro config should extend '@react-native/metro-config'
```
Non-breaking warning. Metro still works correctly with the current `expo/metro-config` setup.

### `server.tls` validation warning
```
Unknown option "server.tls" with value false was found.
```
Non-breaking. Comes from the Expo metro config. Safe to ignore.

### `RangeError: Failed to construct 'Response'` (occasional)
Still appears intermittently in Logcat when network requests fail during Metro disconnection/reconnection cycles. This is not a code bug — it's the fetch polyfill receiving a status 0 when the underlying connection is aborted. Does not crash the app.

---

## Next Steps

### From previous session (still pending)
- Forgot password flow (`supabase.auth.resetPasswordForEmail`)
- Sign out button (call `useAuth().signOut()`)
- Create GW4 round in DB for live testing

### New
- Player stats UI polish — consider charts or visual stat bars in `PlayerDetailScreen`
- Season stats leaderboard using the new `010` view
- Test blocks/sprints scoring is calculating correctly in `calculateGameweekPoints`

---

## Fresh Supabase Project Setup

Run all SQL files in order:
1. `supabase/setup.sql`
2. `supabase/migrations/002_gameweek_features.sql`
3. `supabase/migrations/003_user_profiles.sql`
4. `supabase/migrations/004_fixtures_and_match_stats.sql`
5. `supabase/migrations/005_player_stats_cards_and_clean_sheet.sql`
6. `supabase/migrations/006_user_gw_picks.sql`
7. `supabase/migrations/007_transfer_deductions_and_leaderboard.sql`
8. `supabase/migrations/008_auth_rls_update.sql`
9. `supabase/migrations/009_blocks_sprints_and_scoring_update.sql`
10. `supabase/migrations/010_player_season_stats_view.sql`

Enable Supabase Auth → disable email confirmation for development.
