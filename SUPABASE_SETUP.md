# Supabase Setup Guide for Fantasy Water Polo App

This guide will walk you through setting up Supabase for your Fantasy Water Polo app step by step.

## 🚀 Quick Start Summary

1. **Create Supabase account** → Sign up at https://supabase.com
2. **Create a project** → Name it, set a password, choose region
3. **Get credentials** → Copy Project URL and anon key from Settings > API
4. **Set up database** → Run SQL from `supabase/setup.sql` in SQL Editor
5. **Configure app** → Copy `config/supabaseConfig.example.js` to `config/supabaseConfig.js` and fill in credentials
6. **Test** → Start your app and check if it can fetch data

**Estimated time: 10-15 minutes**

## What is Supabase?

Supabase is an open-source Firebase alternative that provides:
- **PostgreSQL Database** - For storing players, teams, and user data
- **Real-time subscriptions** - For live updates
- **Authentication** - For user management (if needed later)
- **Storage** - For images/files (if needed later)

---

## Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"Sign up"**
3. Sign up using:
   - GitHub (recommended)
   - Email
   - Google account
4. Verify your email if required

---

## Step 2: Create a New Project

1. Once logged in, click **"New Project"** (or the **"+"** button)
2. Fill in the project details:
   - **Name**: `Fantasy Water Polo` (or any name you prefer)
   - **Database Password**: Create a strong password (SAVE THIS - you'll need it!)
   - **Region**: Choose the closest region to you (for better performance)
   - **Pricing Plan**: Select **Free** (perfect for development)
3. Click **"Create new project"**
4. Wait 2-3 minutes for your project to be provisioned

---

## Step 3: Get Your Project Credentials

1. Once your project is ready, go to **Settings** (gear icon in the left sidebar)
2. Click on **"API"** in the settings menu
3. You'll see two important values:
   - **Project URL** - Something like: `https://xxxxx.supabase.co`
   - **anon/public key** - A long string starting with `eyJ...`

4. **Copy both of these values** - you'll need them in the next step!

---

## Step 4: Set Up Your Database Tables

Now we need to create the database tables for your app. We'll use the Supabase SQL Editor.

### 4.1 Open SQL Editor

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**

### 4.2 Create the Tables

**EASIEST METHOD**: Open the file `supabase/setup.sql` in this project and copy all the SQL code, then paste it into the Supabase SQL Editor and click **"Run"**.

**OR** copy and paste the following SQL code into the SQL Editor, then click **"Run"**:

```sql
-- Create teams table (real water polo teams)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  league TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('GK', 'Outfield')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  points_total INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_teams table (to store user's fantasy team selections)
CREATE TABLE IF NOT EXISTS user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- For now, we'll use a simple user identifier
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  is_starter BOOLEAN NOT NULL DEFAULT false,
  position_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, player_id)
);

-- Create transfers table (to track player transfers)
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  player_in_id UUID REFERENCES players(id) ON DELETE SET NULL,
  player_out_id UUID REFERENCES players(id) ON DELETE SET NULL,
  round INTEGER NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rounds table (to track game rounds/weeks)
CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number INTEGER NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_round ON transfers(round);
```

### 4.3 Enable Row Level Security (RLS)

For now, we'll allow public read access (you can secure it later):

```sql
-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access (for development)
CREATE POLICY "Allow public read access on teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Allow public read access on players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public read access on rounds" ON rounds FOR SELECT USING (true);

-- Allow authenticated users to manage their own teams and transfers
-- For now, we'll allow public access (you can add authentication later)
CREATE POLICY "Allow public insert on user_teams" ON user_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on user_teams" ON user_teams FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on user_teams" ON user_teams FOR DELETE USING (true);
CREATE POLICY "Allow public select on user_teams" ON user_teams FOR SELECT USING (true);

CREATE POLICY "Allow public insert on transfers" ON transfers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select on transfers" ON transfers FOR SELECT USING (true);
```

Run this second SQL block as well.

---

## Step 5: Add Sample Data (Optional but Recommended)

Let's add some sample teams and players so you can test your app:

```sql
-- Insert sample teams
INSERT INTO teams (name, league) VALUES
  ('USA National Team', 'International'),
  ('Serbia National Team', 'International'),
  ('Croatia National Team', 'International'),
  ('Italy National Team', 'International'),
  ('Spain National Team', 'International')
ON CONFLICT DO NOTHING;

-- Insert sample players (adjust team_id based on what was created above)
-- First, get the team IDs
-- Then insert players (replace the team_id UUIDs with actual ones from your teams table)

-- Example: Insert a few sample players
-- You'll need to replace the team_id values with actual UUIDs from your teams table
INSERT INTO players (name, position, team_id, price, points_total) VALUES
  ('John Smith', 'GK', (SELECT id FROM teams WHERE name = 'USA National Team' LIMIT 1), 8.5, 120),
  ('Mike Johnson', 'Outfield', (SELECT id FROM teams WHERE name = 'USA National Team' LIMIT 1), 12.0, 150),
  ('Marko Petrovic', 'GK', (SELECT id FROM teams WHERE name = 'Serbia National Team' LIMIT 1), 9.0, 135),
  ('Ivan Horvat', 'Outfield', (SELECT id FROM teams WHERE name = 'Croatia National Team' LIMIT 1), 11.5, 140),
  ('Luca Rossi', 'Outfield', (SELECT id FROM teams WHERE name = 'Italy National Team' LIMIT 1), 10.5, 130)
ON CONFLICT DO NOTHING;
```

**Note**: You can add more players later through the Supabase dashboard or through your app.

---

## Step 6: Configure Your React Native App

Now let's connect your app to Supabase.

### 6.1 Create Your Config File

1. In your project, go to the `config` folder
2. You'll see a file called `supabaseConfig.example.js`
3. **Copy this file** and rename the copy to `supabaseConfig.js`
   - On Windows: Right-click > Copy, then rename
   - On Mac/Linux: `cp config/supabaseConfig.example.js config/supabaseConfig.js`

### 6.2 Fill In Your Credentials

1. Open `config/supabaseConfig.js` (the file you just created)
2. Replace `YOUR_SUPABASE_PROJECT_URL_HERE` with your Project URL from Step 3
3. Replace `YOUR_SUPABASE_ANON_KEY_HERE` with your anon key from Step 3
4. Save the file

**Example:**
```javascript
export const SUPABASE_CONFIG = {
  url: 'https://abcdefghijklmnop.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzMDAwMDAwMCwiZXhwIjoxOTQ1NTYzMjAwfQ.example',
};
```

**Important**: The `supabaseConfig.js` file is already in `.gitignore`, so your credentials won't be committed to git.

---

## Step 7: Test Your Connection

Let's verify everything is working!

### 7.1 Add Some Test Data (Optional)

Before testing, you might want to add some sample players:

1. Go to **"Table Editor"** in Supabase
2. Click on the **"teams"** table
3. Click **"Insert row"** and add a team (e.g., "USA National Team")
4. Click on the **"players"** table
5. Click **"Insert row"** and add a player:
   - `name`: "John Smith"
   - `position`: "GK" (or "Outfield")
   - `team_id`: Select the team you just created
   - `price`: 10.5
   - `points_total`: 100

### 7.2 Test in Your App

Once you've configured everything:

1. **Start Metro bundler**: `npm start` (in one terminal)
2. **Run your app**: `npm run android` or `npm run ios` (in another terminal)
3. Navigate to the **Players** screen
4. The app should be able to fetch players from Supabase

### 7.3 Verify Connection

If you see any errors:
- Check the console/terminal for error messages
- Verify your credentials in `config/supabaseConfig.js`
- Make sure you ran the SQL setup script
- Check that you have internet connection

### 7.4 Check Supabase Dashboard

1. Go to **"Table Editor"** in Supabase
2. Click on the **"players"** table
3. You should see any players you've added
4. You can manually add more players here for testing

---

## ✅ Setup Complete!

Congratulations! Your Supabase setup is complete. Here's what you can do now:

### What's Working:
- ✅ Supabase database is configured
- ✅ Tables are created (teams, players, user_teams, transfers, rounds)
- ✅ Your app can connect to Supabase
- ✅ You can fetch players from the database

### Next Steps:
1. **Add more players** through the Supabase dashboard (Table Editor > players > Insert row)
2. **Integrate player fetching** in your PlayersScreen (use `fetchPlayers()` from `services/playerService.js`)
3. **Build player selection** features using the TeamContext
4. **Add authentication** later if you want user-specific teams

### Useful Resources:
- **Supabase Dashboard**: https://app.supabase.com
- **Supabase Docs**: https://supabase.com/docs
- **Your SQL Setup File**: `supabase/setup.sql` (for reference)
- **Your Config File**: `config/supabaseConfig.js` (keep this private!)

---

## Troubleshooting

### "Invalid API key" error
- Double-check that you copied the **anon/public** key (not the service_role key)
- Make sure there are no extra spaces

### "Failed to fetch" error
- Check your internet connection
- Verify your Project URL is correct
- Make sure RLS policies allow the operation you're trying to perform

### Tables not found
- Make sure you ran all the SQL commands in Step 4
- Check the "Table Editor" in Supabase to see if tables were created

---

## Security Note

⚠️ **Important**: The current setup allows public read/write access for development. Before deploying to production, you should:
1. Implement proper authentication
2. Update RLS policies to restrict access based on user authentication
3. Never expose your `service_role` key in client-side code
