# Emulator Startup Guide

## Normal Daily Startup

**Run the startup script. That's it.**

Open PowerShell in the project folder and run:
```
.\start-dev.ps1
```

Or right-click `start-dev.ps1` in File Explorer → **Run with PowerShell**.

The script will:
1. Wait until the emulator is fully booted (start it in Android Studio first if needed)
2. Set up the adb tunnel automatically
3. Start Metro

Once Metro says `Dev server ready`, open the app drawer on the emulator (swipe up) and tap **FantasyWaterPoloApp**.

---

## Starting the Emulator

If the emulator isn't running yet:
- Open Android Studio
- Open Device Manager (phone icon on the right side panel)
- Click ▶ next to **Medium Phone**
- Wait until the Android home screen is fully visible
- Then run `.\start-dev.ps1`

The script will detect the emulator is already booted and skip straight to starting Metro.

---

## While Developing

| Action | What to do |
|--------|-----------|
| See your latest code changes | Press `r` in the Metro terminal |
| Open the Dev Menu | Press `d` in the Metro terminal |
| Stop Metro | Press `Ctrl+C` in the Metro terminal |

> **Note:** Fast Refresh (auto hot-reload on file save) is disabled in this project to prevent black screen crashes. Press `r` in Metro to reload after making changes.

---

## When to Use Android Studio's Run ▶ Button

The green Run ▶ button in Android Studio rebuilds and reinstalls the APK. You only need this when:

- You've installed a new npm package (`npm install something`)
- You've changed files inside the `android/` folder
- You've wiped the emulator data and the app is no longer installed

For all normal JavaScript/React code changes, **do not use the Run button** — just press `r` in Metro.

---

## If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| Script says "Emulator not ready" | Start the emulator in Android Studio first, wait for home screen, re-run script |
| App shows splash screen but never loads | Run `adb reverse tcp:8081 tcp:8081` then close and reopen the app |
| Black screen | Run: `adb shell am force-stop com.fantasywaterpoloapp` then `adb shell monkey -p com.fantasywaterpoloapp 1` |
| "No devices found" | Emulator hasn't finished booting — the script handles this automatically |
| Metro cache seems broken | Stop Metro, run `npx react-native start --reset-cache` |

---

## Reinstalling the App (After Wipe or Fresh Setup)

If the emulator data was wiped or the app is not installed:

```
.\start-dev.ps1
```
Leave Metro running, then in a **second PowerShell terminal**:
```
cd C:\Users\zorro\FantasyWaterPoloApp
npx react-native run-android --no-packager
```
This builds and installs the APK without starting a second Metro. Takes 1-3 minutes. The app launches automatically when done.
