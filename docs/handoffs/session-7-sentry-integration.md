# Handoff 7 — Sentry Error Tracking Integration

---

## Goal

Add production crash and error visibility via Sentry so that silent failures, unhandled exceptions, and native crashes on users' devices are captured with full stack traces and user context.

---

## What was added

`@sentry/react-native` v8.21.0 with:
- JS crash capture (unhandled errors + manual `captureException`)
- Supabase user ID attached to every event
- Android Gradle plugin for automatic JS source map upload on release builds
- Safe no-op when DSN is missing (dev machines without config won't crash)

---

## Files changed

| File | Change |
|---|---|
| `App.js` | `Sentry.init()` at module load with DSN env var / local config fallback; root component wrapped with `Sentry.wrap()` |
| `context/AuthContext.js` | `Sentry.setUser({ id })` on every `onAuthStateChange` event; `null` on sign-out |
| `android/build.gradle` | Added `io.sentry:sentry-android-gradle-plugin:6.17.0` classpath |
| `android/app/build.gradle` | Applied Sentry AGP + `sentry.gradle` JS source map script; `autoInstallation = false` to prevent version-mix crash |
| `package.json` | `@sentry/react-native` added |
| `.gitignore` | `config/sentryConfig.js` and `android/sentry.properties` excluded |

---

## Gitignored credential files

These are excluded from git and must be created locally on each machine.

**`config/sentryConfig.js`**
```js
export const SENTRY_CONFIG = {
  dsn: 'YOUR_DSN_HERE',
  // e.g. 'https://abc123@o123456.ingest.de.sentry.io/789012'
};
```

**`android/sentry.properties`**
```properties
defaults.url=https://sentry.io/
defaults.org=YOUR_ORG_SLUG
defaults.project=YOUR_PROJECT_SLUG
auth.token=YOUR_SENTRY_AUTH_TOKEN
```

### Where to find these values
- **DSN**: sentry.io → Project Settings → Client Keys (DSNs)
- **Org/project slug**: visible in the sentry.io URL (`sentry.io/organizations/<org>/projects/<project>`)
- **Auth token**: sentry.io → Settings → Auth Tokens — needs `project:releases` + `org:read` scopes

---

## How Sentry is initialized (`App.js`)

```js
let sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (!sentryDsn) {
  const { SENTRY_CONFIG } = require('./config/sentryConfig');
  sentryDsn = SENTRY_CONFIG.dsn;
}

Sentry.init({
  dsn: sentryDsn,
  tracesSampleRate: 1.0,
  enabled: !!sentryDsn && sentryDsn !== 'YOUR_SENTRY_DSN_HERE',
});
```

`enabled: false` when the placeholder is detected — the app runs normally without Sentry on machines without the config file.

---

## Source map uploads

JS source maps upload automatically during `./gradlew assembleRelease` via the `sentry.gradle` script. No manual step needed.

After a release build, verify at: sentry.io → Project Settings → Source Maps.

If stack traces show `index.android.bundle:1:XXXXX` instead of real file/line numbers, the `android/sentry.properties` auth token is missing or wrong.

---

## User context

Every Sentry event is tagged with the Supabase user UUID via `Sentry.setUser({ id })` in `AuthContext.js`. This fires on login, token refresh, and logout. On logout, `Sentry.setUser(null)` clears the context.

---

## Verified working (dev build)

- `Sentry.captureMessage()` → event received on dashboard within ~5 seconds ✓
- `Sentry.captureException()` → exception with stack trace received ✓
- Unhandled crash → captured and reported on next app launch ✓

---

## Note on release builds

The Sentry Gradle plugin (`io.sentry:sentry-android-gradle-plugin:6.17.0`) requires:
- Android Gradle Plugin ≥ 7.4.0 ✓ (project uses 36.0.0 build tools)
- Kotlin ≥ 1.8 ✓ (project uses 2.1.20)
- `autoInstallation = false` ✓ (set — prevents `IllegalStateException: mix of versions` crash)

After adding Sentry, the first `npx react-native run-android` is required to rebuild and reinstall the app. After that, day-to-day `start-dev.ps1` usage is unaffected.
