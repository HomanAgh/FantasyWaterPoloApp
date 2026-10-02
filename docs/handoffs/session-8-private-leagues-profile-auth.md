# Handoff 8 — Private Leagues, Profile Tab & Auth Redesign

---

## Goal

Ship private mini-leagues (create / join / leave / kick + invite codes), a Profile tab with logout, auth UX upgrades (forgot password, show/hide password, neon glass UI + Barlow fonts), and tighten DB write access before a store launch. Also wire Android release signing via a local `keystore.properties` file.

**Stack:** React Native 0.83, Expo ~55, Supabase, Android physical device (USB)

---

## Current State

All previous features remain intact (GW snapshots, global leaderboard SECURITY DEFINER, Sentry). This session layers private leagues on top of the same scoring model as the global board.

**New in this session:**
- Private leagues with invite-code join (client never touches league tables directly — all via RPCs)
- League detail screen: standings, share invite, leave, admin kick, report team name
- Profile tab (email, team name, log out)
- Auth screen redesign + forgot-password flow + password visibility toggles
- Barlow Condensed fonts loaded in `App.js`
- Migrations 013–016 (admin write lock, private leagues, leave/kick, team name reports)
- Android release signing config (credentials stay gitignored)

**Branch:** `feat/private-leagues-and-profile` (cut from `origin/main` after PR #1 merge)

---

## Files Changed

| File | Change |
|------|--------|
| `App.js` | Load Barlow fonts before render; Profile tab; `LeagueDetail` stack screen |
| `screens/LeaguesScreen.js` | Create / join private leagues UI; list my leagues; navigate to detail |
| `screens/LeagueDetailScreen.js` | **New.** League standings, share code, leave, kick, report name |
| `screens/ProfileScreen.js` | **New.** Account card + logout |
| `screens/AuthScreen.js` | Neon glass UI; login / signup / forgot modes; eye toggle; min password 8 |
| `screens/HomeScreen.js` | Tap GW points → My Team; small UI polish |
| `components/LeaderboardItem.js` | **New.** Shared rank row (gold/silver/bronze); kick + long-press hooks |
| `services/leagueService.js` | `createLeague`, `joinLeague`, `fetchMyLeagues`, standings, leave, kick |
| `services/userProfileService.js` | `reportTeamName` → `report_team_name` RPC |
| `context/AuthContext.js` | `resetPassword` via `supabase.auth.resetPasswordForEmail` |
| `styles/theme.js` | `colors.auth.*` tokens; `fonts.barlowCondensed*` |
| `assets/images/icons.js` | `eye`, `letter` |
| `assets/images/eye.png`, `letter.png` | **New.** Auth icon assets |
| `package.json` / lock | `@expo-google-fonts/barlow-condensed`, `expo-font`, `expo-asset` |
| `app.json` | `expo-font` + `expo-asset` plugins |
| `android/app/build.gradle` | Release signing from `keystore.properties` |
| `.gitignore` | `android/keystore.properties` |
| `supabase/migrations/013_*.sql` | Drop open FOR ALL write policies on fixtures / stats / points |
| `supabase/migrations/014_*.sql` | `leagues`, `league_members` + create/join/`get_my_leagues`/standings RPCs |
| `supabase/migrations/015_*.sql` | `leave_league`, `kick_league_member`; standings ambiguity fix |
| `supabase/migrations/016_*.sql` | `team_name_reports` + `report_team_name` RPC |

---

## Private Leagues — How It Works

### Data model (migration 014)

- `leagues` — `id`, `name`, `invite_code` (unique), `created_by`, `created_at`
- `league_members` — `(league_id, user_id)` membership

### Client access pattern

The anon/authenticated client **does not** SELECT/INSERT on these tables. Everything goes through SECURITY DEFINER RPCs so invite codes cannot be enumerated and standings can read `user_gw_picks` under RLS.

| RPC | Purpose |
|-----|---------|
| `create_league(name)` | Creates league + membership for caller; returns invite code |
| `join_league(code)` | Join by invite code |
| `get_my_leagues()` | Leagues the caller belongs to |
| `get_league_leaderboard(league_id, …)` | Season totals among members (same scoring as global) |
| `get_user_league_rank(league_id)` | Caller’s rank in that league |
| `leave_league(league_id)` | Non-admin leave; admin only if last member (deletes league) |
| `kick_league_member(league_id, user_id)` | Admin-only kick |

Standings reuse the same season-total logic as `get_global_leaderboard()` (migration 012), scoped to members. Users with no GW picks yet still appear at 0 pts.

### App navigation

1. **Leagues** tab → create / join / list
2. Tap a league → **LeagueDetail** stack screen
3. Share invite code (native Share), leave, or (admin) kick from a row

---

## Profile & Auth

### Profile tab

- Shows session email + team name from `TeamContext`
- Log out calls `signOut()`; `AuthContext` clears session → `App.js` shows `AuthScreen`

### Forgot password

```js
await supabase.auth.resetPasswordForEmail(email.trim(), {
  redirectTo: 'https://auth.fantasy-water-polo.com',
});
```

User gets an email link, sets a new password in the browser, then returns to the app to sign in. Ensure that redirect URL is allowlisted in Supabase Auth → URL Configuration.

### Auth UI notes

- Placeholders in `AuthScreen.js` for optional Figma assets:
  - `AUTH_BG` → `auth-bg.png`
  - `AUTH_TITLE` → `auth-title.png`
- Until those files exist, keep both `null` (solid `colors.auth.background` fallback).
- Password minimum raised to **8** characters (was 6).

### Fonts

`App.js` blocks first paint on `useFonts({ BarlowCondensed_400Regular, BarlowCondensed_800ExtraBold_Italic })` and shows `LoadingScreen` until ready. Theme exports:

```js
fonts.barlowCondensedRegular
fonts.barlowCondensedExtraBoldItalic
```

---

## Migrations — How to Run

Run **in order** in Supabase Dashboard → SQL Editor (paste full file → Run):

1. `013_lock_admin_write_tables.sql` — closes anon write hole on fixtures / match stats / round points. Admin continues via Dashboard (postgres role bypasses RLS).
2. `014_private_leagues.sql` — tables + core RPCs
3. `015_league_leave_kick.sql` — leave/kick + leaderboard `user_id` ambiguity fix (`#variable_conflict use_column`)
4. `016_team_name_reports.sql` — reports table + RPC

### Verify private leagues

```sql
-- Tables exist
SELECT tablename FROM pg_tables
WHERE tablename IN ('leagues', 'league_members', 'team_name_reports');

-- RPCs exist
SELECT proname FROM pg_proc
WHERE proname IN (
  'create_league', 'join_league', 'get_my_leagues',
  'get_league_leaderboard', 'get_user_league_rank',
  'leave_league', 'kick_league_member', 'report_team_name'
);
```

### Moderate team name reports

```sql
SELECT * FROM team_name_reports
WHERE status = 'open'
ORDER BY created_at DESC;
```

Resolve/dismiss by updating `status` and renaming `user_profiles.team_name` when needed (see comments in migration 016).

---

## Android release signing

`android/app/build.gradle` reads `android/keystore.properties` (gitignored). Create locally:

```properties
storeFile=../your-release.keystore
storePassword=...
keyAlias=...
keyPassword=...
```

Without this file, debug builds still work; release builds need the properties file present.

---

## Known Limitations / Follow-ups

- Kicked users can rejoin with the same invite code (no regenerate-code yet).
- Password-reset deep link returns users to the **website**, not an in-app password form — intentional for now.
- Auth Figma background/title PNGs not committed yet (`AUTH_BG` / `AUTH_TITLE` still `null`).
- Client helpers marked “admin” for fixtures/points will fail after migration 013 if called from the app — expected; manage scores in Dashboard only.

---

## Quick Smoke Test

1. Run migrations 013→016 on the project Supabase.
2. `npm install` (new font / expo-font packages).
3. Sign up / log in; try forgot-password email.
4. Profile tab → confirm email + logout.
5. Leagues → create league → share code → second account joins.
6. Open league detail → standings, leave / kick, long-press report team name.
7. Confirm fixtures/stats cannot be written with the anon key after 013.
