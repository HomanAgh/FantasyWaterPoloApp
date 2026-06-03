# Handoff 2 — Fantasy Water Polo App

---

## Goal

Add real user accounts to the app. Replace the previous anonymous device-based identity (random string in AsyncStorage) with Supabase Auth email/password accounts. Users can sign up, log in, and have their team and points tied to a real account that persists across devices and app reinstalls.

**Stack:** React Native (Expo), Supabase Auth (GoTrue), `expo-secure-store` for JWT session persistence.

---

## Current State

Auth is implemented and tested on the Android emulator:

- Sign up with email + password — working.
- Log in with email + password — working.
- Session persists across app restarts (stored securely via `expo-secure-store`) — working.
- New users are routed to `OnboardingScreen` to pick a team name after account creation — working.
- Returning users go directly to the main app — working.
- All user data (team, transfers, points, deductions) is now tied to the Supabase Auth UUID — working.
- RLS policies updated — only authenticated users can write their own rows — working.

**All previous gameplay features (squad, transfers, points, leaderboard) remain intact.**

**Latest branch pushed to GitHub:** `feature/supabase-auth`

**Previous branch:** `feature/fpl-gameweek-logic`

---

## Files in Flight

| File | Role |
|------|------|
| `context/AuthContext.js` | **New.** Manages Supabase auth session. Provides `userId`, `session`, `isLoadingAuth`, `signIn`, `signUp`, `signOut` via `useAuth()` hook. |
| `screens/AuthScreen.js` | **New.** Login + sign up screen with two tabs. Matches existing ocean theme. |
| `config/supabaseClient.js` | `createClient` now passes `expo-secure-store` adapter so JWT session is encrypted on device. |
| `App.js` | Wraps app in `AuthProvider`. Gates content: no session → `AuthScreen`, session + no profile → `OnboardingScreen`, session + profile → main tabs. |
| `context/TeamContext.js` | Replaced `getUserId()` call with `useAuth().userId`. Re-initializes team data when auth user changes. Clears all state on sign-out. |
| `components/LoadingScreen.js` | Fixed broken color references (`colors.primary` → `colors.oceanMedium`, `colors.background` → `colors.backgroundLight`). |
| `supabase/migrations/008_auth_rls_update.sql` | **New.** Drops all open `USING (true)` write policies and replaces them with `auth.uid()::text = user_id` on all user tables. |

---

## Database Changes

Migration `008_auth_rls_update.sql` was run manually in Supabase SQL Editor.

**What changed:**

All write policies on user-owned tables now require the caller to own the row:

```sql
-- Example pattern applied to all 5 tables:
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id)
```

Tables affected: `user_profiles`, `user_teams`, `transfers`, `user_gw_picks`, `user_round_deductions`.

Public read-only tables (`teams`, `players`, `rounds`, `fixtures`, `player_round_points`) remain open for SELECT — all users need to read them.

**Why `::text` cast:**
`auth.uid()` returns a UUID type. The `user_id` columns are `TEXT`. The cast bridges the type mismatch without requiring a schema migration.

**Important — old anonymous data:**
Any rows created before auth was added (with the old `user_xxx_timestamp` random IDs) are now orphaned — no authenticated user can write to them. The DB was cleared of test data before going live. Any fresh Supabase project setup must run all migrations in order (see bottom of this file).

---

## What's Been Changed

### `context/AuthContext.js` (new file)
- Calls `supabase.auth.getSession()` on mount to restore existing session.
- Added 6-second timeout + `.catch()` so if `getSession()` hangs (e.g. SecureStore unavailable), `isLoadingAuth` unblocks and shows the auth screen rather than hanging forever.
- Subscribes to `onAuthStateChange` — session updates (sign in, sign out, token refresh) propagate instantly.
- Exposes `userId` as `session?.user?.id ?? null` — this is the Supabase Auth UUID stored as string, matching the `user_id TEXT` columns in all tables.

### `screens/AuthScreen.js` (new file)
- Two tabs: Sign In / Create Account.
- Validates email format and minimum 6-character password before submitting.
- Handles common error messages: wrong credentials, email not confirmed, account already exists.
- Matches existing app visual style (ocean blues, wave background, card layout).

### `config/supabaseClient.js`
- Added `SecureStoreAdapter` using `expo-secure-store` `getItemAsync` / `setItemAsync` / `deleteItemAsync`.
- Passed to `createClient` as `auth.storage` with `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`.

### `App.js`
- Added `AuthProvider` as outermost wrapper (outside `RoundProvider` and `TeamProvider`).
- `AppContent` reads `userId` and `isLoadingAuth` from `useAuth()`.
- Navigation flow: `isLoadingAuth` → `LoadingScreen` → no `userId` → `AuthScreen` → `userId` + no profile → `OnboardingScreen` → main tabs.
- Removed `getUserId` import and `checkOnboardingStatus` logic (replaced by auth-aware equivalent).

### `context/TeamContext.js`
- Removed `import { getUserId } from '../utils/userIdHelper'`.
- Added `import { useAuth } from './AuthContext'`.
- `initializeTeam()` now accepts `id` directly instead of calling `getUserId()`.
- Mount `useEffect` now watches `authUserId` — fires when user logs in, clears all state when user logs out.

### `components/LoadingScreen.js`
- `colors.primary` (undefined) → `colors.oceanMedium`.
- `colors.background` (undefined) → `colors.backgroundLight`.
- Previously rendered as a transparent/black screen. Now shows a visible light blue background with spinner.

---

## Known Issues / Warnings

### `process.env.EXPO_OS` warning
```
The global process.env.EXPO_OS is not defined.
```
`expo-secure-store` uses this variable internally to detect platform. It's normally injected by `babel-preset-expo`. The project uses `@react-native/babel-preset` as its primary preset, so the injection doesn't happen. **This is a warning only — SecureStore still works.** Fix for production: add `babel-preset-expo` to `babel.config.js`.

### `expo-secure-store` version
Must stay at `~55.0.0` to match `expo@55`. Version `56.x` causes a native crash on launch because it requires `expo-modules-core@56`. Do not run `npm install expo-secure-store` without pinning the version.

---

## Failed Attempts

### `expo-secure-store@56.0.4` native crash
- **What happened:** `npm install expo-secure-store` (no version) installed `56.0.4`. The app crashed with a black screen immediately on launch — no JS logs, no Metro connection.
- **Why it failed:** Version 56 requires `expo-modules-core@56` but the project uses `expo@55` / `expo-modules-core@55`. The native module failed to load before JS could start.
- **Fix:** `npm install expo-secure-store@~55.0.0` → installs `55.0.14`. Then clean build: `cd android && .\gradlew clean && cd .. && npm run android`.

### Emulator storage full
- **What happened:** `npm run android` failed with `INSTALL_FAILED_INSUFFICIENT_STORAGE`.
- **Why it happened:** Running `npm run android` on every session builds and installs a new APK each time. Debug APKs are large. After many builds the emulator's virtual storage filled up.
- **Fix:** `adb shell pm trim-caches 1000000000` — frees emulator cache space silently.
- **Prevention:** Only run `npm run android` when native code changes. For normal JS development: start the emulator, run `npm start`, open the app, press `r` to reload. No rebuild needed.

### Emulator black screen (graphics crash)
- **What happened:** App showed black screen; even Android Settings turned black.
- **Why it happened:** Emulator graphics subsystem crashed — unrelated to app code.
- **Fix:** Android Studio → Device Manager → Cold Boot Now.

---

## Next Steps

### Forgot password flow
`supabase.auth.resetPasswordForEmail(email)` is the call. Needs:
1. A "Forgot password?" link on the Sign In tab in `AuthScreen.js`.
2. An input for the user's email + a call to the above function.
3. A confirmation message to check inbox.
4. For mobile deep-link redirect back into app after clicking email link — more complex, requires `Linking` API setup.

### Sign out button
No sign-out exists yet anywhere in the app. Add to a settings screen or the Leagues/Home screen header. The call is `supabase.auth.signOut()` (already exposed via `useAuth().signOut`).

### Fix `babel.config.js` for production
Add `babel-preset-expo` to eliminate the `process.env.EXPO_OS` warning:
```js
module.exports = {
  presets: ['babel-preset-expo'],
};
```
Test that existing JS still bundles correctly after this change.

### Create GW4 to resume live testing
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

---

## Fresh Supabase Project Setup

Run all SQL files in this order:
1. `supabase/setup.sql`
2. `supabase/migrations/002_gameweek_features.sql`
3. `supabase/migrations/003_user_profiles.sql`
4. `supabase/migrations/004_fixtures_and_match_stats.sql`
5. `supabase/migrations/005_player_stats_cards_and_clean_sheet.sql`
6. `supabase/migrations/006_user_gw_picks.sql`
7. `supabase/migrations/007_transfer_deductions_and_leaderboard.sql`
8. `supabase/migrations/008_auth_rls_update.sql`

Also enable Supabase Auth → **disable email confirmation** for development so users can sign up and play immediately without checking inbox.
