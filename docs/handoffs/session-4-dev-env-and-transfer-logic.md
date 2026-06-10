# Handoff 4 — Dev Environment Overhaul & Transfer Logic Fixes

---

## Goal

Fix the persistent emulator startup issues that were blocking development, switch to a physical phone for testing, and tighten the squad transfer logic to prevent bypassing transfer costs post-finalization.

**Stack:** React Native 0.83, Supabase, Android physical device (USB)

---

## Current State

All previous features remain intact. Development now runs on a physical Android phone via USB — more reliable than the emulator.

**New in this session:**
- One-command dev startup via `start-dev.ps1`
- Root cause of native crash on startup identified and fixed (Google Mobile Ads missing App ID)
- Squad finalization timing fixed for late joiners
- Players screen and Transfers screen enforce transfer rules post-finalization

**Branch:** `fix/babel-dark-mode-player-stats` (continued from session 3, same branch)

---

## Files Changed

| File | Change |
|------|--------|
| `start-dev.ps1` | **New.** One-command dev startup script — detects phone or emulator, runs adb reverse, starts Metro |
| `android/app/src/main/AndroidManifest.xml` | Added Google Mobile Ads test App ID to fix native crash on startup |
| `context/TeamContext.js` | Fixed squad finalization timing for late joiners |
| `screens/PlayersScreen.js` | Post-finalization: redirects to Transfers instead of direct add/remove |
| `screens/TransfersScreen.js` | "Remove from Team" hidden post-finalization; removed unused Auto-pick and Add Players buttons |
| `screens/MyTeamScreen.js` | Empty slot tap now navigates to Transfers directly; removed Quick Actions bar |
| `docs/dev-setup/emulator-startup.md` | Rewritten to use `start-dev.ps1` |
| `docs/troubleshooting/black-screen-fix.md` | Updated standard startup section to reference script |

---

## Dev Environment — What Changed

### Problem
The emulator was causing persistent black screens and connection failures. Root causes:
1. `adb reverse` was being run before the emulator finished booting — tunnel never established
2. `react-native-google-mobile-ads` was installed but had no App ID configured — native SDK crashed the app on startup before JS could load
3. Fast Refresh hot-reload caused black screen when navigating away and returning

### Solution

**`start-dev.ps1`** (project root) — run this instead of manual steps:
```
.\start-dev.ps1
```
Polls `adb devices` + `sys.boot_completed` until the device is ready, then runs `adb reverse` and starts Metro. Works with both a physical phone (USB) and the Android emulator.

**`AndroidManifest.xml`** — added Google test App ID to stop the native crash:
```xml
<meta-data
  android:name="com.google.android.gms.ads.APPLICATION_ID"
  android:value="ca-app-pub-3940256099942544~3347511713"
  tools:replace="android:value"/>
```
Note: this is Google's official test ID. Replace with a real AdMob App ID if ads are ever activated.

**Physical phone** is now the primary dev device. USB Debugging enabled. No Android Studio emulator needed for daily work.

### First-time setup after switching devices or wiping

With Metro running (`.\start-dev.ps1`), in a second terminal:
```
adb reverse tcp:8081 tcp:8081
npx react-native run-android --no-packager
```

---

## Logic Fixes

### 1. Squad Finalization Timing (`TeamContext.js`)

**Problem:** Late joiners (users who first open the app after GW1 has already passed) had their squad immediately finalized on first open, skipping the unlimited squad-building phase entirely.

**Old logic:**
```js
const shouldFinalize =
  (currentRound.round_number === 1 && isLocked) ||
  currentRound.round_number > 1;
```

**Fixed logic:**
```js
const shouldFinalize = isLocked;
```

Now finalization only happens once the first gameweek the user participates in has locked — regardless of which round number that is.

### 2. Post-Finalization Transfer Enforcement (`PlayersScreen.js`)

After squad finalization, players can no longer be freely added or removed from the Players screen (which would bypass transfer cost rules). Instead:

- **In-team player button** shows `⇄` and tapping it shows an alert directing the user to the Transfers screen
- **Add player button** on a full squad shows `⇄` and navigates to the Transfers screen
- Both are disabled during `isLocked` (show `🔒`)

The `mode === 'replace'` flow (called from Transfers) still works normally.

### 3. Transfers Screen — Remove Button Hidden Post-Finalization (`TransfersScreen.js`)

The "Remove from Team" button in the player action modal is now only shown during `isUnlimitedPhase`. After finalization, all removals must go through the Replace flow to correctly consume a transfer and deduct cost.

---

## Known Issues / Warnings

### Metro config warning
```
From React Native 0.73, your project's Metro config should extend '@react-native/metro-config'
```
Non-breaking. Metro still works correctly with `expo/metro-config`.

### `server.tls` validation warning
```
Unknown option "server.tls" with value false was found.
```
Non-breaking. Comes from Expo metro config. Safe to ignore.

### Google Mobile Ads test App ID
The AdMob ID in `AndroidManifest.xml` is Google's official test ID (`ca-app-pub-3940256099942544~3347511713`). It will log test ad warnings in logcat — these are harmless. Replace with a real ID only when actually integrating ads.

---

## Next Steps

### From previous sessions (still pending)
- Forgot password flow (`supabase.auth.resetPasswordForEmail`)
- Sign out button (`useAuth().signOut()`)
- Player stats UI polish — stat bars or charts in `PlayerDetailScreen`
- Season stats leaderboard using the `010` view
- Test blocks/sprints scoring calculation in `calculateGameweekPoints`

### New
- Test late-joiner finalization fix with a real account that joins mid-season
- Test that replacing a player post-finalization correctly deducts a transfer

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
