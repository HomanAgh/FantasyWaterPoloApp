# Team Name & Onboarding Feature

## What Was Implemented

### 1. Database Migration
- Created `supabase/migrations/003_user_profiles.sql`
- Adds `user_profiles` table with `user_id`, `team_name`, `free_transfers`, transfer-state columns

### 2. Service Layer
- Created `services/userProfileService.js` with functions:
  - `getUserProfile(userId)` — fetch user profile
  - `createUserProfile(userId, teamName)` — create new profile
  - `updateTeamName(userId, teamName)` — update team name
  - `checkIfProfileExists(userId)` — check if profile exists

### 3. Screens
- `screens/OnboardingScreen.js` — collects team name from new users after account creation
- `components/LoadingScreen.js` — shown while session and profile are being resolved

### 4. Context
- `context/TeamContext.js` — holds `teamName` state, `loadTeamName()`, `updateTeamName()`
- `context/AuthContext.js` — manages Supabase auth session, gates the app

### 5. App Flow
- `App.js` checks auth session first, then profile existence, then routes accordingly

---

## User Flow

### New User
```
App Launch
    ↓
Auth Screen — "Create Account" tab
  - Enter email + password
  - Tap "Create Account"
    ↓
Onboarding Screen
  - "Welcome to Fantasy Water Polo!"
  - Enter team name (3–30 characters)
  - Tap "Create My Team"
    ↓
Main App (team name saved, ready to play)
```

### Returning User (session active)
```
App Launch
    ↓
Loading Screen (restoring session from SecureStore)
    ↓
Main App (session restored, team name loaded)
```

### Returning User (session expired)
```
App Launch
    ↓
Loading Screen (session check)
    ↓
Auth Screen — "Sign In" tab
  - Enter email + password
    ↓
Main App
```

---

## Team Name Rules

- **Minimum**: 3 characters
- **Maximum**: 30 characters
- **Allowed characters**: Letters (a–z, A–Z), numbers (0–9), spaces, hyphens, underscores, apostrophes, exclamation marks

---

## Where the Team Name Appears

- Home Screen — team card header
- My Team Screen — screen header
- Leagues Screen — leaderboard rows

---

## Future Enhancements

1. **Edit Team Name** — add button in My Team or settings screen, call `updateTeamName()`
2. **Team Avatars** — add `avatar_url` field to `user_profiles`, let users pick preset icons
3. **Team Colors** — `primary_color` / `secondary_color` fields, customize UI per user
