# Emulator Startup Guide

## Normal Daily Startup

Use this every time you sit down to develop.

**1. Start the emulator**
- Open Android Studio
- Open Device Manager (phone icon on the right side panel)
- Click ▶ next to **Medium Phone** to start it
- Wait until the Android home screen is fully visible

**2. Open PowerShell and run:**
```
cd C:\Users\zorro\FantasyWaterPoloApp
adb reverse tcp:8081 tcp:8081
npm start
```
`adb reverse` should print `8081`. If it says "no devices found", the emulator hasn't finished booting — wait a few seconds and try again.

**3. Wait for Metro to say:**
```
Dev server ready.
```

**4. On the emulator screen:**
- Swipe up from the bottom to open the app drawer
- Find and tap **FantasyWaterPoloApp**

The app will load. You're ready to develop.

---

## While Developing

| Action | What to do |
|--------|-----------|
| See your latest code changes | Press `r` in the Metro terminal |
| Open the Dev Menu | Press `d` in the Metro terminal |
| Stop Metro | Press `Ctrl+C` in the Metro terminal |

---

## Do I Need `adb reverse` Every Time?

- **Yes, if you fully closed the emulator** since your last session — run it before `npm start`
- **No, if the emulator was just sleeping/minimised** — you can skip it and go straight to `npm start`

If the app fails to load or Metro shows "Cannot connect", just run `adb reverse tcp:8081 tcp:8081` and press `r` to reload.

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
| "Cannot connect to Metro" | Run `adb reverse tcp:8081 tcp:8081` then press `r` |
| App shows old code | Press `r` in Metro terminal |
| Black screen | See `docs/troubleshooting/black-screen-fix.md` |
| "No devices found" on `adb reverse` | Emulator hasn't finished booting — wait and retry |
| Metro cache seems broken | Stop Metro, run `npx react-native start --reset-cache` |

---

## Reinstalling the App (After Wipe or Fresh Setup)

If the emulator data was wiped or the app is not installed:

```
adb reverse tcp:8081 tcp:8081
npm start
```
Leave Metro running, then in a **second PowerShell terminal**:
```
cd C:\Users\zorro\FantasyWaterPoloApp
npx react-native run-android --no-packager
```
This builds and installs the APK without starting a second Metro. Takes 1-3 minutes. The app launches automatically when done.
