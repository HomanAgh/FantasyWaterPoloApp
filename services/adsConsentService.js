import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
} from 'react-native-google-mobile-ads';

let gatherPromise = null;
let lastConsentInfo = null;

/**
 * __DEV__ only: hashed UMP test-device IDs so debugGeography applies.
 * Release builds never use these — getConsentRequestOptions returns {}.
 */
const DEV_UMP_TEST_DEVICE_IDS = [
  '84AC99DD397CA9C1DA02F99462F99304',
];

/**
 * Options for UMP. debugGeography / test devices are __DEV__ only.
 * Production/release uses real geography so AdMob picks EU vs US messages
 * automatically from the user's region.
 */
function getConsentRequestOptions() {
  if (!__DEV__) {
    return {};
  }
  const options = {
    debugGeography: AdsConsentDebugGeography.EEA,
  };
  if (DEV_UMP_TEST_DEVICE_IDS.length > 0) {
    options.testDeviceIdentifiers = DEV_UMP_TEST_DEVICE_IDS;
  }
  return options;
}

/**
 * Request consent info and show Google's UMP form when required.
 * Safe to call multiple times — only gathers once per app session (unless reset).
 *
 * @returns {Promise<{ ok: boolean, canRequestAds: boolean, info: object|null, error?: string }>}
 */
export function gatherAdsConsent() {
  if (gatherPromise) {
    return gatherPromise;
  }

  gatherPromise = (async () => {
    try {
      const info = await AdsConsent.gatherConsent(getConsentRequestOptions());
      lastConsentInfo = info;
      return {
        ok: true,
        canRequestAds: !!info?.canRequestAds,
        info,
      };
    } catch (err) {
      console.warn('[adsConsent] gatherConsent failed:', err?.message || err);
      // On failure, fall back to any existing consent from a previous session.
      try {
        const info = await AdsConsent.getConsentInfo();
        lastConsentInfo = info;
        return {
          ok: false,
          canRequestAds: !!info?.canRequestAds,
          info,
          error: err?.message || 'consent_gather_failed',
        };
      } catch (readErr) {
        console.warn(
          '[adsConsent] getConsentInfo after failure also failed:',
          readErr?.message || readErr
        );
        return {
          ok: false,
          canRequestAds: false,
          info: null,
          error: err?.message || 'consent_gather_failed',
        };
      }
    }
  })();

  return gatherPromise;
}

/**
 * Read current UMP consent info (does not show a form).
 */
export async function getAdsConsentInfo() {
  try {
    const info = await AdsConsent.getConsentInfo();
    lastConsentInfo = info;
    return info;
  } catch (err) {
    console.warn('[adsConsent] getConsentInfo failed:', err?.message || err);
    return lastConsentInfo;
  }
}

export async function canRequestAdsNow() {
  const info = await getAdsConsentInfo();
  return !!info?.canRequestAds;
}

export function isPrivacyOptionsRequired(info) {
  return (
    info?.privacyOptionsRequirementStatus ===
    AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
  );
}

/**
 * Open Google's privacy options form when required/available.
 * @returns {Promise<{ ok: boolean, shown: boolean, canRequestAds: boolean, error?: string }>}
 */
export async function openPrivacyOptionsForm() {
  try {
    // Refresh info first so we know if options are required.
    await AdsConsent.requestInfoUpdate(getConsentRequestOptions());
    const before = await AdsConsent.getConsentInfo();
    lastConsentInfo = before;

    if (
      before.privacyOptionsRequirementStatus ===
      AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED
    ) {
      return {
        ok: true,
        shown: false,
        canRequestAds: !!before.canRequestAds,
        error: 'not_required',
      };
    }

    const after = await AdsConsent.showPrivacyOptionsForm();
    lastConsentInfo = after;
    // Allow a fresh gather next session path if needed
    return {
      ok: true,
      shown: true,
      canRequestAds: !!after?.canRequestAds,
    };
  } catch (err) {
    console.warn('[adsConsent] privacy options failed:', err?.message || err);
    return {
      ok: false,
      shown: false,
      canRequestAds: false,
      error: err?.message || 'privacy_options_failed',
    };
  }
}

/**
 * After user changes privacy choices, allow ads startup to run again if needed.
 */
export function resetConsentGatherCache() {
  gatherPromise = null;
}

/**
 * Clear UMP consent on-device so the form can be shown again.
 * Development only — no-ops in release builds.
 *
 * @returns {{ ok: boolean, error?: string }}
 */
export function resetUmpConsentForDev() {
  if (!__DEV__) {
    return { ok: false, error: 'dev_only' };
  }
  try {
    AdsConsent.reset();
    lastConsentInfo = null;
    resetConsentGatherCache();
    return { ok: true };
  } catch (err) {
    console.warn('[adsConsent] reset failed:', err?.message || err);
    return { ok: false, error: err?.message || 'reset_failed' };
  }
}
