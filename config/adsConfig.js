/**
 * AdMob configuration.
 *
 * SAFETY:
 * - `__DEV__` always uses Google's official demo rewarded unit (TestIds.REWARDED).
 *   Safe to watch/click while developing.
 * - Release builds use PRODUCTION_REWARDED_AD_UNIT_ID below.
 * - Android App ID lives in app.json → react-native-google-mobile-ads.android_app_id
 *   (rebuild native after changing it).
 *
 * Do not click live ads on your own devices unless the device is registered
 * as a test device in AdMob.
 */

/** Fantasy Water Polo — Rewarded (AdMob). Used only in release builds. */
export const PRODUCTION_REWARDED_AD_UNIT_ID =
  'ca-app-pub-5616032972593206/9226456549';

/** Kill switch — set false to disable all ad UI/loads without removing code. */
export const ADS_ENABLED = true;
