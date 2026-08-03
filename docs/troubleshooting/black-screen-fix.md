# Black Screen Fix — Android / Physical Device

## Symptom

The app launches, the native splash screen shows, then the screen goes completely black. The app never reaches the Home tab or any screen. Restarting Metro does not fix it.

## Standard Daily Startup

**Run the startup script — it handles everything:**

```
.\start-dev.ps1
```

Then tap the **FantasyWaterPoloApp** icon on your phone or emulator. See `docs/dev-setup/emulator-startup.md` for full details.

**Never run `npm run android` repeatedly.** It reinstalls the APK each time and corrupts the Android Activity state.

---

## Root Causes (All Fixed)

### 1. Android Dark Mode — `NavigationContainer` inheriting system theme

**Problem:** The Android emulator (or device) was in Dark Mode. `NavigationContainer` automatically inherits the system colour scheme. In dark mode, its background becomes `rgb(1, 1, 1)` — essentially black — making the entire app appear black even though JS was running correctly. The Settings app on the emulator also went black, confirming this was a system-level dark mode issue.

You can disable dark mode via ADB if the screen is too black to navigate:
```bash
adb shell cmd uimode night no
# or force light mode permanently:
adb shell settings put secure ui_night_mode 1
```

**Fix applied:** Force the app to always use the light theme regardless of system settings:
```js
// App.js
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';

<NavigationContainer theme={DefaultTheme}>
```

### 2. Wrong Babel Preset (`babel.config.js`)

**Problem:** `babel.config.js` was using `@react-native/babel-preset`, but the project uses Expo modules (`expo-secure-store`, `expo-constants`, etc.) which require `babel-preset-expo`. Without it, the `EXPO_OS` global is never injected, causing `expo-secure-store` to malfunction during Supabase session restoration:

```
RangeError: Failed to construct 'Response': The status provided (0) is outside the range [200, 599].
```

In the New Architecture (Fabric), this error is silently swallowed, producing a black screen with no red error overlay.

**Fix applied:**
```js
// babel.config.js
module.exports = {
  presets: ['babel-preset-expo'],
};
```

### 3. Missing `SafeAreaProvider` (`App.js`)

**Problem:** `useSafeAreaInsets()` was called inside `MainTabs` but the app had no `<SafeAreaProvider>` wrapping it. In `react-native-safe-area-context` v5+, this throws a silent crash in Fabric/New Architecture.

**Fix applied:** Wrapped the root `App` component with `SafeAreaProvider`:
```js
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        ...
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

### 4. Corrupted Android Activity State (Hot-Reload Loop)

**Problem:** Running `npm run android` multiple times, or pressing `r` in Metro repeatedly, caused the Android Activity to enter a broken state. JS was running fine (Logcat showed auth and profile checks succeeding) but the Android surface was torn down between reloads so nothing could be rendered.

**Fix:** Follow the standard startup above. If already broken, do a full clean restart (close everything, restart emulator, `adb reverse`, `npm start`, tap icon).

---

## Recovery — If the App Goes Black Mid-Session

**If pressing Home causes a black screen when you return:**

This is the Fast Refresh hot-reload issue. To recover:

1. In Metro terminal, press `d` to open Dev Menu on the emulator
2. Tap **"Disable Fast Refresh"**
3. Press `r` in Metro to reload

If the screen is already black and unresponsive:

```bash
# Kill and relaunch the app via adb
adb shell am force-stop com.fantasywaterpoloapp
adb shell monkey -p com.fantasywaterpoloapp 1
```

Or close the app from the emulator's recent apps, then tap the icon again.

---

## Diagnostic Steps (If It Happens Again)

1. **Check if emulator is in dark mode:**
   ```bash
   adb shell cmd uimode night no
   ```

2. **Check Logcat for JS errors:**
   ```bash
   adb logcat ReactNativeJS:I *:S
   ```
   If you see `RangeError: Failed to construct 'Response'`, the babel preset may have regressed.

3. **Check Logcat for surface/activity errors:**
   ```bash
   adb logcat *:E
   ```
   Look for `SurfaceMountingManager: Stopping surface`. If present, do a full clean restart.

4. **Reset Metro cache** (if app shows stale code):
   ```bash
   npx react-native start --reset-cache
   ```

5. **Re-run adb reverse** (if Metro can't connect after emulator restart):
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```

6. **Reinstall the app** (after wiping emulator data or if APK is corrupted):
   ```bash
   npx react-native run-android --no-packager
   ```
   (`--no-packager` keeps your existing Metro session running)

---

## Files Changed in This Fix

| File | Change |
|------|--------|
| `babel.config.js` | Changed preset from `@react-native/babel-preset` to `babel-preset-expo` |
| `App.js` | Added `SafeAreaProvider` wrapper around root component |
| `App.js` | Added `theme={DefaultTheme}` to `NavigationContainer` to prevent dark mode black screen |
