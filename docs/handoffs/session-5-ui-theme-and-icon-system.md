# Handoff 5 — UI Theme Overhaul & Custom Icon System

---

## Goal

Replace the light-blue ocean colour palette with a proper water-polo colour scheme (deep navy dominant, gold accents, red danger indicators) and eliminate all emoji icons in favour of a consistent PNG icon system sourced from local assets.

**Stack:** React Native 0.83, Supabase, Android physical device (USB)

---

## Current State

All previous features remain intact. The app now has a cohesive visual identity that matches the sport: dark navy backgrounds, gold highlights (yellow cap colour), and red danger/warning cues (red cap colour).

**New in this session:**
- Complete colour palette swap in `styles/theme.js`
- 25 custom PNG icons added under `assets/images/`
- Central icon registry at `assets/images/icons.js`
- Every emoji in the app replaced with a tinted `<Image>` component
- Tab bar redesigned — dark navy background, gold active tint
- Warning / locked banners updated to use theme colours throughout

**Branch:** `feat/ui-theme-and-icon-system` (new branch for this session)

---

## Files Changed

| File | Change |
|------|--------|
| `styles/theme.js` | **Rewritten.** Navy-dominant palette; gold (`#FFC107`) as highlight; red (`#E53935`) for danger; `pearl` replaces off-white |
| `assets/images/icons.js` | **New.** Central registry mapping 25 PNG assets to named keys (`Icons.trophy`, `Icons.locked`, etc.) |
| `assets/images/*.png` | **New.** 25 PNG icon files (see table below) |
| `App.js` | Tab bar: navy bg, gold active tint; all tab icons swapped to `<Image source={Icons.X}>` |
| `screens/HomeScreen.js` | All emojis replaced; card borders / colours aligned to new theme |
| `screens/MyTeamScreen.js` | All emojis replaced; locked/warning banners use `colors.coral` |
| `screens/AuthScreen.js` | All emojis replaced; tabs and card background use `colors.pearl` |
| `screens/OnboardingScreen.js` | All emojis replaced; subtitle row now inline image + text |
| `screens/PlayersScreen.js` | All emojis replaced; locked/error banners use `colors.coral` |
| `screens/TransfersScreen.js` | All emojis replaced; transfer info badges use icons |
| `screens/FixturesScreen.js` | All emojis replaced; venue row now icon + text |
| `screens/LeaguesScreen.js` | All emojis replaced; rank badge uses `Icons.badge`; `getRankEmoji` helper removed |
| `screens/PlayerDetailScreen.js` | `StatCell` updated to accept `icon` prop; section headings use icon + text rows |
| `components/PlayerCard.js` | GK/field emoji replaced; captain badge colours use theme tokens |
| `components/PitchView.js` | Empty-slot emoji replaced with `Icons.goalie` / `Icons.player` |

---

## Icon System

### Registry — `assets/images/icons.js`

```js
export const Icons = {
  goal:       require('./033-goal.png'),
  handshake:  require('./077-handshake.png'),
  block:      require('./045-ad-blocker.png'),
  sprint:     require('./066-flash-2.png'),
  wave:       require('./096-sea-wave.png'),
  redCard:    require('./146-red-card-5.png'),
  gloves:     require('./027-gloves.png'),
  calendar:   require('./005-calendar.png'),
  field:      require('./104-field.png'),
  trophy:     require('./036-trophy.png'),
  games:      require('./013-lifebuoy.png'),
  cleansheet: require('./057-brick-wall-1.png'),
  player:     require('./025-sport.png'),
  goalie:     require('./138-football-goal.png'),
  graph:      require('./068-graph-1.png'),
  clock:      require('./061-alarm.png'),
  locked:     require('./040-locked.png'),
  warning:    require('./017-warning-7.png'),
  swap:       require('./006-swap.png'),
  water:      require('./031-water-2.png'),
  house:      require('./003-house-1.png'),
  swimmer:    require('./029-swim.png'),
  badge:      require('./018-badge.png'),
};
```

### How to use an icon

```jsx
import { Icons } from '../assets/images/icons';

// Basic usage
<Image source={Icons.trophy} style={{ width: 24, height: 24, resizeMode: 'contain' }} />

// With tintColor (all icons are monochrome PNG — tint controls colour)
<Image source={Icons.locked} style={{ width: 20, height: 20, resizeMode: 'contain', tintColor: colors.coral }} />
```

All icons are monochrome PNGs designed to be tinted at render time via the `tintColor` style property. The tab bar icons use `focused ? colors.sand : colors.textMuted` to toggle active/inactive states.

### Adding a new icon

1. Drop the PNG into `assets/images/`
2. Add a named key to `assets/images/icons.js`
3. Use `Icons.<key>` anywhere in the app

---

## Colour Palette — What Changed

| Token | Old value | New value | Usage |
|-------|-----------|-----------|-------|
| `oceanDeep` | `#006994` (mid blue) | `#0D1B2A` (deep navy) | Headers, tab bar background |
| `oceanMedium` | `#0088cc` | `#1B3A5C` (navy) | Cards, nav elements |
| `oceanLight` | `#00a8e8` | `#2E6DA4` (steel blue) | Borders, secondary text |
| `oceanBright` | `#00d4ff` | `#4A9FD4` (sky blue) | Highlights, pitch lines |
| `sand` | `#f4e4bc` (beige) | `#FFC107` (gold) | Active tab, accents, point values |
| `coral` | `#ff6b6b` | `#E53935` (red) | Danger, locked banners, warnings |
| `pearl` | `#f8f9fa` | `#D6E8F5` (light blue) | Card backgrounds (replaces `white`) |
| `backgroundGradient` | `['#006994','#00a8e8']` | `['#0D1B2A','#1B3A5C']` | Screen header gradients |
| `warning` | `#f39c12` | `#FFC107` | Aligned with `sand` gold |
| `error` | `#e74c3c` | `#E53935` | Aligned with `coral` red |
| `pitch.background` | `#2d8f3a` (green) | `#1B3A5C` (navy) | Water polo pool is water, not grass |
| `pitch.lines` | `#ffffff` | `#4A9FD4` | Sky blue lane lines |

---

## Tab Bar

**Before:** White background, ocean-blue active tint, emoji labels  
**After:** Deep navy (`#0D1B2A`) background, gold (`#FFC107`) active tint, PNG icon images with `tintColor`

```jsx
tabBarStyle: {
  backgroundColor: colors.oceanDeep,   // deep navy
  borderTopColor: colors.sand + '60',  // gold border, 60% opacity
},
tabBarActiveTintColor: colors.sand,    // gold
tabBarInactiveTintColor: colors.textMuted,
tabBarIcon: ({ focused }) => (
  <Image
    source={Icons.trophy}
    style={{ width: 24, height: 24, resizeMode: 'contain',
             tintColor: focused ? colors.sand : colors.textMuted }}
  />
)
```

---

## Key Patterns Introduced

### Replacing an emoji with an icon

**Before:**
```jsx
<Text style={{ fontSize: 24 }}>🏆</Text>
```

**After:**
```jsx
<Image source={Icons.trophy} style={{ width: 24, height: 24, resizeMode: 'contain' }} />
```

For large decorative icons (headers), use `width: 48, height: 48`. For inline text-row icons use `width: 14–16, height: 14–16` with `gap: 5` on the parent row.

### Inline icon + text row

Several places now show a small icon alongside a text label using a `flexDirection: 'row'` wrapper:

```jsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
  <Image source={Icons.warning} style={{ width: 14, height: 14, resizeMode: 'contain' }} />
  <Text>Team incomplete</Text>
</View>
```

---

## Known Issues / Warnings

### `getRankEmoji` removed in LeaguesScreen
The top-3 medal emoji helper was removed. Top-3 entries now show `Icons.badge` (gold badge PNG). The visual distinction between 1st/2nd/3rd is currently lost — all three show the same badge icon. Can be improved in a future session (different badge icons or tintColor variation: gold, silver, bronze).

### `tintColor` on complex PNGs
`tintColor` works best on flat monochrome PNGs. If any icon has subtle shading, it may look slightly off at certain tint colours. All current icons were chosen for their flat / monochrome style, so this should not be an issue.

### Metro config warnings (carry-over from session 4)
```
From React Native 0.73, your project's Metro config should extend '@react-native/metro-config'
Unknown option "server.tls" with value false was found.
```
Both are non-breaking and safe to ignore.

---

## Next Steps

### From previous sessions (still pending)
- Forgot password flow (`supabase.auth.resetPasswordForEmail`)
- Sign out button (`useAuth().signOut()`)
- Player stats UI polish — stat bars / charts in `PlayerDetailScreen`
- Season stats leaderboard using the `010` view
- Test blocks/sprints scoring calculation in `calculateGameweekPoints`
- Test late-joiner finalization fix
- Test post-finalization transfer deduction

### New after this session
- Top-3 leaderboard badge differentiation (gold / silver / bronze tint or separate icons)
- Dark mode consideration — navy theme works well for dark mode; `pearl` card bg would need adjustment
- Icon audit: `Icons.games` currently uses a lifebuoy (`013-lifebuoy.png`) — may want to replace with a more fitting "games played" icon
- Consider adding `Icons.plus` for add-player actions (currently reusing `Icons.player`)

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
