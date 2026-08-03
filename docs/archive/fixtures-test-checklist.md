# Fixtures Feature Test Checklist

## Pre-Testing Setup ✅

### Files Created
- [x] `supabase/migrations/004_fixtures_and_match_stats.sql` - Database migration
- [x] `services/fixtureService.js` - Service layer with API functions
- [x] `screens/FixturesScreen.js` - UI component
- [x] `supabase/test_data/fixtures_test_data.sql` - Test data script
- [x] `FIXTURES_SETUP_GUIDE.md` - Setup documentation
- [x] `App.js` - Updated with Fixtures tab

### Code Quality
- [x] No linter errors
- [x] Follows existing code patterns (roundService, HomeScreen)
- [x] Ocean-themed styling consistent with app design
- [x] Proper error handling in service functions

## Database Setup Tests

### Step 1: Run Migration
```sql
-- Run: supabase/migrations/004_fixtures_and_match_stats.sql
-- Expected: Tables created successfully
```

**Verification Query:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('fixtures', 'player_match_stats');
```
- [ ] Both tables exist
- [ ] Indexes created
- [ ] RLS policies enabled

### Step 2: Test Data
```sql
-- Run: supabase/test_data/fixtures_test_data.sql
-- Expected: Sample fixtures and stats inserted
```

**Verification Query:**
```sql
-- Check fixtures
SELECT 
  f.id,
  r.round_number,
  ht.name as home_team,
  f.home_score,
  at.name as away_team,
  f.away_score,
  f.status
FROM fixtures f
JOIN teams ht ON f.home_team_id = ht.id
JOIN teams at ON f.away_team_id = at.id
JOIN rounds r ON f.round_id = r.id;

-- Check player stats
SELECT 
  p.name,
  pms.goals,
  pms.assists,
  pms.points_earned
FROM player_match_stats pms
JOIN players p ON pms.player_id = p.id
ORDER BY pms.points_earned DESC;
```
- [ ] At least 2 fixtures created
- [ ] Fixtures have correct team references
- [ ] Player stats linked to fixtures
- [ ] Points calculated correctly

## App Integration Tests

### Navigation
- [ ] App starts without errors
- [ ] 6 tabs visible in bottom navigation
- [ ] Fixtures tab appears between Transfers and Leagues
- [ ] Tapping Fixtures tab navigates to FixturesScreen

### UI Display - Empty State
*Test when no fixtures exist*
- [ ] Header displays with wave emoji (🌊)
- [ ] Title shows "Fixtures"
- [ ] Subtitle shows "Match schedule & results"
- [ ] Empty state shows swimmer emoji (🏊‍♂️)
- [ ] Message: "No fixtures scheduled"
- [ ] Subtext: "Check back soon for upcoming matches!"

### UI Display - With Data
*Test after adding fixture data*

#### Header & Navigation
- [ ] Ocean-themed header with gradient effect
- [ ] Gameweek tabs appear below header
- [ ] Current gameweek highlighted (active tab)
- [ ] Can scroll through gameweek tabs
- [ ] Tapping different gameweek loads its fixtures

#### Fixture Cards
- [ ] Cards have ocean-themed left border
- [ ] Team names displayed correctly
- [ ] Scores shown for non-scheduled matches
- [ ] "vs" separator between teams
- [ ] Match date formatted correctly
- [ ] Status badge displays with correct color:
  - Blue for "SCHEDULED" 📅
  - Orange for "LIVE" ●
  - Green for "FINISHED" ✓

#### Top Performers Section
*Only visible for finished matches*
- [ ] "⭐ Top Performers" title displays
- [ ] Shows up to 3 performers
- [ ] Rank badges (1, 2, 3) in ocean-colored circles
- [ ] Player names displayed
- [ ] Stats formatted correctly (e.g., "2G, 1A")
- [ ] Points shown on right side
- [ ] Section has light ocean-colored background

#### Additional Features
- [ ] Venue information shows (if available)
- [ ] Pull-to-refresh works
- [ ] Loading spinner appears during data fetch
- [ ] Smooth scrolling through fixtures
- [ ] Cards have proper shadows and spacing

## Functional Tests

### Service Functions
Test in JavaScript console or add temporary logging:

```javascript
import { 
  fetchFixturesForRound, 
  fetchTopPerformers,
  formatMatchDate,
  getFixtureStatusStyle,
  formatPlayerStats
} from './services/fixtureService';

// Test 1: Fetch fixtures for a round
const { data, error } = await fetchFixturesForRound('round-uuid');
// Expected: Array of fixtures with team names

// Test 2: Fetch top performers
const { data: performers } = await fetchTopPerformers('fixture-uuid');
// Expected: Array of up to 3 player stats, sorted by points

// Test 3: Format match date
const formatted = formatMatchDate('2026-03-25T18:00:00Z');
// Expected: "Mar 25, 06:00 PM" (or similar)

// Test 4: Get status style
const style = getFixtureStatusStyle('finished');
// Expected: { color: '#2ecc71', backgroundColor: '#d4edda', ... }

// Test 5: Format player stats
const stats = formatPlayerStats({ goals: 2, assists: 1, saves: 0 });
// Expected: "2G, 1A"
```

### Context Integration
- [ ] `useRound()` provides `currentRound`
- [ ] `useRound()` provides `allRounds`
- [ ] FixturesScreen uses correct round ID
- [ ] Switching gameweeks triggers data reload

## Performance Tests

- [ ] Initial load completes in < 2 seconds
- [ ] Gameweek switching is smooth (< 500ms)
- [ ] Pull-to-refresh completes quickly
- [ ] No memory leaks when navigating away
- [ ] Scrolling is smooth with 10+ fixtures

## Edge Cases

### No Data Scenarios
- [ ] No fixtures in database → Shows empty state
- [ ] No rounds in database → No gameweek tabs, graceful handling
- [ ] No top performers → Finished matches display without performers section
- [ ] Null/undefined team names → Shows "TBD"

### Data Validation
- [ ] Fixture with null scores (scheduled) → No scores shown
- [ ] Fixture with 0-0 score (finished) → Shows "0" for both teams
- [ ] Player with 0 points → Still displays in top performers if in top 3
- [ ] Long team names → Text truncates with ellipsis
- [ ] Long venue names → Displays correctly, wraps if needed

### Error Handling
- [ ] Network error → Shows error message or previous data
- [ ] Invalid round ID → Handles gracefully
- [ ] Supabase connection error → Doesn't crash app
- [ ] Missing team data → Shows placeholder

## Styling Consistency

### Colors (from theme.js)
- [ ] `colors.oceanDeep` used for header background
- [ ] `colors.oceanMedium` used for primary accents
- [ ] `colors.oceanBright` used for highlights
- [ ] `colors.white` for card backgrounds
- [ ] `shadows.medium` for card elevation
- [ ] `borderRadius.large` for cards
- [ ] `spacing.md` for consistent margins

### Typography
- [ ] Header title: 32px, bold, white
- [ ] Card titles: 20px, bold
- [ ] Team names: 18px, bold
- [ ] Body text: 14-16px
- [ ] Consistent font weights

### Layout
- [ ] Proper padding and margins
- [ ] Cards aligned correctly
- [ ] Elements centered appropriately
- [ ] Responsive to different screen sizes

## Accessibility

- [ ] Text is readable (sufficient contrast)
- [ ] Touch targets are large enough (44x44 minimum)
- [ ] Status colors distinguishable
- [ ] Emojis enhance but don't replace text meaning

## Documentation

- [ ] FIXTURES_SETUP_GUIDE.md is clear and complete
- [ ] SQL migration has comments
- [ ] Service functions have JSDoc comments
- [ ] Test data script has instructions

## User Acceptance Criteria

From the original plan, verify:
- [x] Dedicated Fixtures screen created
- [x] 6th tab in app navigation
- [x] Displays all matches for current gameweek
- [x] Shows team names and scores
- [x] Shows match dates and times
- [x] Status badges (Scheduled/Live/Finished)
- [x] Top-performing players displayed
- [x] Ocean-themed styling
- [x] Can switch between gameweeks
- [x] Pull-to-refresh functionality

## Known Limitations & Future Enhancements

### Current Limitations
- No real-time live updates (requires WebSocket/polling)
- Manual data entry via SQL (no admin UI)
- No fixture details page (tap to expand)
- No filtering by team or date range

### Possible Enhancements
1. Real-time score updates during live matches
2. Push notifications for match start/end
3. Fixture details modal/page with full stats
4. Filter fixtures by favorite teams
5. Calendar view of fixtures
6. Share fixture results
7. Predict match outcomes (user engagement)

## Sign-Off

### Developer Checklist
- [x] All files created
- [x] Code follows project patterns
- [x] No linter errors
- [x] Documentation complete
- [x] Test data provided

### Testing Sign-Off
Once tested, check these:
- [ ] All database tests passed
- [ ] All UI tests passed
- [ ] All functional tests passed
- [ ] All edge cases handled
- [ ] Performance acceptable
- [ ] User acceptance criteria met

---

## Quick Test Commands

```bash
# Start the app
npm start

# Or with Expo
npx expo start

# Check for TypeScript/Lint errors
npm run lint  # if configured
```

## Quick SQL Test Queries

```sql
-- Count fixtures
SELECT COUNT(*) FROM fixtures;

-- Count player stats
SELECT COUNT(*) FROM player_match_stats;

-- Top performers across all matches
SELECT 
  p.name,
  SUM(pms.points_earned) as total_points,
  SUM(pms.goals) as total_goals,
  SUM(pms.assists) as total_assists
FROM player_match_stats pms
JOIN players p ON pms.player_id = p.id
GROUP BY p.id, p.name
ORDER BY total_points DESC
LIMIT 10;
```

---

**Status**: ✅ Ready for Testing

All code has been implemented according to the plan. The feature is ready for database setup and app testing by the user.
