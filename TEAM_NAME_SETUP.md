# Team Name Feature - Setup Instructions

## ✅ What's Been Implemented

### 1. Database Migration
- Created `supabase/migrations/003_user_profiles.sql`
- Adds `user_profiles` table with team_name field

### 2. Service Layer
- Created `services/userProfileService.js` with functions:
  - `getUserProfile(userId)` - Fetch user profile
  - `createUserProfile(userId, teamName)` - Create new profile
  - `updateTeamName(userId, teamName)` - Update team name
  - `checkIfProfileExists(userId)` - Check if profile exists

### 3. Components
- Created `screens/OnboardingScreen.js` - Welcome screen for new users
- Created `components/LoadingScreen.js` - Simple loading screen

### 4. Context Updates
- Updated `context/TeamContext.js`:
  - Added `teamName` state
  - Added `loadTeamName()` function
  - Added `updateTeamName()` function

### 5. App Flow
- Updated `App.js`:
  - Checks if user profile exists on app launch
  - Shows onboarding screen for new users
  - Skips onboarding for returning users

### 6. UI Updates
- Updated `screens/MyTeamScreen.js` - Displays team name instead of "My Team"
- Updated `screens/HomeScreen.js` - Displays team name in team card

---

## 🚀 How to Deploy

### Step 1: Run Database Migration in Supabase

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor** in the left sidebar
3. Click **"New query"**
4. Open the file `supabase/migrations/003_user_profiles.sql` in your code editor
5. Copy **all the SQL code** from that file
6. Paste it into the Supabase SQL Editor
7. Click **"Run"** (or press Ctrl+Enter)

You should see: ✅ **"Success. No rows returned"**

### Step 2: Verify the Migration

Run this query in Supabase to verify the table was created:

```sql
SELECT * FROM user_profiles LIMIT 5;
```

You should see an empty table with columns: `id`, `user_id`, `team_name`, `created_at`, `updated_at`

### Step 3: Test the App

1. Reload your React Native app (shake device → "Reload" or press R in Metro)
2. You should see the **Onboarding Screen** with:
   - Welcome message
   - Team name input field
   - "Create My Team" button
3. Enter a team name (3-30 characters)
4. Click "Create My Team"
5. You should be taken to the main app
6. Your team name should now appear on:
   - Home Screen (in the team card)
   - My Team Screen (in the header)

---

## 📋 User Flow

### First Time User:
```
App Launch
    ↓
Loading Screen (checking profile...)
    ↓
Onboarding Screen
  - "Welcome to Fantasy Water Polo!"
  - Enter team name
  - Click "Create My Team"
    ↓
Main App (team name saved and displayed)
```

### Returning User:
```
App Launch
    ↓
Loading Screen (checking profile...)
    ↓
Main App (profile exists, team name loaded)
```

---

## 🎨 Team Name Rules

- **Minimum**: 3 characters
- **Maximum**: 30 characters
- **Allowed characters**: 
  - Letters (a-z, A-Z)
  - Numbers (0-9)
  - Spaces
  - Hyphens (-), underscores (_), apostrophes ('), exclamation marks (!)

---

## 🔮 Future Enhancements (Optional)

1. **Edit Team Name**
   - Add "Edit Team Name" button in My Team Screen
   - Show modal with text input
   - Call `updateTeamName()` function

2. **Team Avatars/Icons**
   - Add `avatar_url` field to `user_profiles` table
   - Let users pick from preset icons

3. **Team Colors**
   - Add `primary_color` and `secondary_color` fields
   - Customize UI colors per user

4. **Team Stats**
   - Add `total_points`, `rank`, `leagues_joined` fields
   - Display on profile page

---

## ✅ Complete!

You're all set! New users will now see the onboarding screen and can set their team name. 🎉
