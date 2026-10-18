# Handoff 11 — Rewarded Ads, Scout Gate & League Scoring Start

---

## Goal

Add Google rewarded ads (UMP consent first), let managers unlock banked free transfers and 2-hour team scouting with an ad, and let a new private league count points from the next gameweek onward. Next Play build is **1.1.2 / versionCode 6** (pushed session 10 is 1.1.1 / 5).

**Stack:** React Native 0.83, Expo ~55, Supabase, Android physical device (USB)

---

## Current State

Sessions 8–10 are still stacked and not on `main`:

| PR / branch | Notes |
|-------------|--------|
| [#2](https://github.com/HomanAgh/FantasyWaterPoloApp/pull/2) `feat/private-leagues-and-profile` | Session 8 — open, base `main` |
| [#3](https://github.com/HomanAgh/FantasyWaterPoloApp/pull/3) `feat/autosub-squad9-scoring` | Session 9 — open, base session 8 |
| `feat/view-team-steals-snapshot` @ `3df56e7` | Session 10 — pushed 11 Oct 2026, **no PR** |
| **`feat/rewarded-ads-league-start`** | **This session** — cut from session 10 tip |

**New in this session:**
- AdMob rewarded ads via `react-native-google-mobile-ads` 16.3.4
- UMP consent before any ad request; `__DEV__` uses Google demo units + EEA debug geography
- Migration **023** — `unlocked_free_transfers`; watch an ad to unlock one banked free transfer this GW
- Scout gate — other managers’ View Team requires a rewarded ad; access lasts 2 hours on device
- Migration **024** — `leagues.scoring_start_round_id`; create-league option “start from next gameweek”
- Store version **1.1.1 / 5 → 1.1.2 / 6**
- `app.json` Android package set to `com.fantasywaterpoloapp` so it matches `applicationId`

**Branch:** `feat/rewarded-ads-league-start` (cut from `feat/view-team-steals-snapshot`)

---

## Files Changed (high level)

| Area | Files |
|------|--------|
| Ads | `config/adsConfig.js`, `services/adsService.js`, `services/adsConsentService.js`, `App.js`, `app.json`, `package.json` |
| Free-transfer unlock | `023_unlocked_free_transfers.sql`, `services/transferService.js`, `context/TeamContext.js`, `screens/TransfersScreen.js`, `screens/PlayersScreen.js` |
| Scout gate | `services/scoutAccessService.js`, `screens/LeaguesScreen.js`, `screens/LeagueDetailScreen.js`, `screens/ViewTeamScreen.js` |
| League start | `024_league_scoring_start.sql`, `services/leagueService.js`, `screens/LeaguesScreen.js`, `screens/LeagueDetailScreen.js` |
| Profile | `screens/ProfileScreen.js` (legal links already in `utils/legalUrls.js`) |
| Pitch / leaderboard polish | `components/PitchView.js` (compact), `components/LeaderboardItem.js`, `screens/MyTeamScreen.js`, `screens/HomeScreen.js`, `screens/PlayerDetailScreen.js` |
| Version | `app.json`, `android/app/build.gradle` |

---

## Rewarded ads

- Startup waits for fonts, then `startAdsIfAllowed`. Consent is gathered first. Ads load only when `canRequestAds` is true.
- `__DEV__` always requests `TestIds.REWARDED`. Release uses the production rewarded unit in `config/adsConfig.js`.
- `ADS_ENABLED` in `adsConfig.js` is the kill switch.
- Android App ID is `react-native-google-mobile-ads.android_app_id` in `app.json`. Change it only with a native rebuild.
- Profile has Privacy Choices (UMP form) and a dev-only test-ad / reset-UMP card.

## Free-transfer unlock (023)

`free_transfers` stays the banked count (0–2). `unlocked_free_transfers` is how many of those are usable this GW after ads. A transfer spends an unlocked slot first; otherwise it is a point hit. Rollover resets the unlocked count. The client writes the column after a completed reward.

## Scout gate

Tapping view-team on someone else’s row runs confirm → rewarded ad → `AsyncStorage` expiry (`SCOUT_ACCESS_HOURS` = 2). Your own row opens View Team with no ad. This is a client gate. Locked squads are still the only data the RPCs return (session 10).

## League scoring start (024)

`create_league(league_name, start_from_next_round)` replaces the one-argument function. `true` stores the earliest round whose deadline is still in the future. `NULL` keeps full-season totals for existing leagues. Leaderboard recomputes with autosub inside the league window (points and deductions before the start round are ignored). Late joiners score from that start GW, not from their join date.

---

## Migrations — How to Run

After 020–022, in Supabase Dashboard → SQL Editor:

1. `023_unlocked_free_transfers.sql`
2. `024_league_scoring_start.sql`

### Quick verify

```sql
SELECT column_name FROM information_schema.columns
WHERE (table_name = 'user_profiles' AND column_name = 'unlocked_free_transfers')
   OR (table_name = 'leagues' AND column_name = 'scoring_start_round_id');
```

---

## Play Store note

Build a signed release AAB from this commit at **1.1.2 / versionCode 6** after 023 and 024 are on prod. Session 10’s pushed commit is still 1.1.1 / 5. `applicationId` stays `com.fantasywaterpoloapp`.

---

## Known limitations

- Scout access and free-transfer unlock are enforced in the client. A user who can update their own `user_profiles` row can raise `unlocked_free_transfers` without an ad. Scout expiry lives only in AsyncStorage.
- View Team is still locked GW snapshots only (session 10).
- PR stack to `main` is still #2 → #3 → session 10 (no PR yet) → this branch.
- Native rebuild required after the AdMob app id change.

---

## Quick smoke test

1. Migrations 023 and 024 applied.
2. Dev build: Profile → TEST REWARDED AD shows a Google sample ad. Privacy Choices opens UMP.
3. Transfers: with a banked free transfer, UNLOCK FREE TRANSFER → ad → next transfer uses it and does not add a hit.
4. Leagues: eye on another manager → ad → View Team; eye again inside 2 hours skips the ad; own row skips the ad.
5. Create league → start from next gameweek → card shows FROM GAMEWEEK N; standings ignore earlier GWs.
6. Release versionCode is 6.
