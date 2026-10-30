import { Platform } from 'react-native';

/** Last known ATT status on iOS. Null until ensureTrackingPermission runs. */
let lastStatus = null;

/**
 * Lazy-load expo-tracking-transparency only on iOS.
 * A top-level import crashes Android when the native module isn't linked
 * ("Cannot find native module ExpoTrackingTransparency").
 */
function getAttModule() {
  // eslint-disable-next-line global-require
  return require('expo-tracking-transparency');
}

/**
 * Whether Apple ATT allows personalized / IDFA-linked ads.
 * Android has no ATT — returns true so UMP alone gates personalization.
 */
export function isTrackingAuthorized() {
  if (Platform.OS !== 'ios') {
    return true;
  }
  return lastStatus === 'granted';
}

/**
 * iOS: request non-personalized ads unless ATT status is granted.
 * Android: always allow personalized when UMP permits (unchanged).
 */
export function shouldRequestNonPersonalizedAdsOnly() {
  if (Platform.OS !== 'ios') {
    return false;
  }
  // Until ATT has been resolved, treat as not authorized (NPA).
  return lastStatus !== 'granted';
}

/**
 * iOS only: read ATT status and show the system prompt when undetermined.
 * Call after UMP and before Mobile Ads initialize / ad loads.
 * No-ops on Android (authorized: true).
 *
 * @returns {Promise<{ status: string, authorized: boolean, error?: string }>}
 */
export async function ensureTrackingPermission() {
  if (Platform.OS !== 'ios') {
    lastStatus = 'granted';
    return { status: 'granted', authorized: true };
  }

  try {
    const {
      getTrackingPermissionsAsync,
      requestTrackingPermissionsAsync,
    } = getAttModule();

    const current = await getTrackingPermissionsAsync();
    if (current.status === 'undetermined') {
      const requested = await requestTrackingPermissionsAsync();
      lastStatus = requested.status;
      return {
        status: requested.status,
        authorized: requested.status === 'granted',
      };
    }

    lastStatus = current.status;
    return {
      status: current.status,
      authorized: current.status === 'granted',
    };
  } catch (err) {
    console.warn('[att] ensureTrackingPermission failed:', err?.message || err);
    // Fail closed on iOS — do not track without a clear grant.
    lastStatus = 'denied';
    return {
      status: 'denied',
      authorized: false,
      error: err?.message || 'att_failed',
    };
  }
}

export function getCachedTrackingStatus() {
  return lastStatus;
}
