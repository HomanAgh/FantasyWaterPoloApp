import { Platform } from 'react-native';
import mobileAds, {
  AdEventType,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { ADS_ENABLED, PRODUCTION_REWARDED_AD_UNIT_ID } from '../config/adsConfig';
import {
  canRequestAdsNow,
  gatherAdsConsent,
} from './adsConsentService';
import {
  ensureTrackingPermission,
  shouldRequestNonPersonalizedAdsOnly,
} from './attService';

let initPromise = null;
let rewardedAd = null;
/** NPA flag used when the current RewardedAd instance was created. */
let rewardedAdNpa = null;
let isLoaded = false;
let startAdsPromise = null;

function getRewardedAdUnitId() {
  if (__DEV__) {
    return TestIds.REWARDED;
  }
  if (PRODUCTION_REWARDED_AD_UNIT_ID) {
    return PRODUCTION_REWARDED_AD_UNIT_ID;
  }
  // iOS unit not created yet: use Google's test unit so TestFlight builds can
  // exercise the ad flow. Replace IOS_REWARDED_AD_UNIT_ID before App Store release.
  return Platform.OS === 'ios' ? TestIds.REWARDED : null;
}

/**
 * Initialize the Google Mobile Ads SDK once. Safe to call multiple times.
 * Callers must only invoke this when UMP allows ad requests (canRequestAds).
 */
export function initializeAds() {
  if (!ADS_ENABLED) {
    return Promise.resolve({ ok: false, reason: 'disabled' });
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.T,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
      await mobileAds().initialize();
      return { ok: true };
    } catch (err) {
      console.warn('[ads] initialize failed:', err?.message || err);
      initPromise = null;
      return { ok: false, reason: err?.message || 'init_failed' };
    }
  })();

  return initPromise;
}

/**
 * UMP → ATT (iOS) → initialize Mobile Ads when canRequestAds.
 * Single-flight to avoid duplicate forms / init.
 *
 * @param {{ preload?: boolean }} [options]
 */
export function startAdsIfAllowed(options = {}) {
  const { preload = true } = options;

  if (!ADS_ENABLED) {
    return Promise.resolve({
      ok: false,
      reason: 'disabled',
      canRequestAds: false,
    });
  }

  if (!startAdsPromise) {
    startAdsPromise = (async () => {
      const consent = await gatherAdsConsent();
      if (!consent.canRequestAds) {
        startAdsPromise = null;
        return {
          ok: false,
          reason: 'consent_blocked',
          canRequestAds: false,
          consent,
        };
      }

      // After GDPR/UMP, request ATT before any ad SDK init or load (iOS).
      const att = await ensureTrackingPermission();

      const init = await initializeAds();
      if (!init.ok) {
        startAdsPromise = null;
        return {
          ok: false,
          reason: init.reason || 'init_failed',
          canRequestAds: true,
          consent,
          att,
        };
      }

      return {
        ok: true,
        canRequestAds: true,
        consent,
        att,
      };
    })();
  }

  return startAdsPromise.then((result) => {
    if (result?.ok && preload) {
      loadRewardedAdIfReady();
    }
    return result;
  });
}

/**
 * After privacy options change, clear the start lock so ads can start if now allowed.
 */
export function resetAdsStartCache() {
  startAdsPromise = null;
}

function ensureRewardedInstance() {
  const unitId = getRewardedAdUnitId();
  if (!unitId) {
    return null;
  }

  // Personalized only when ATT granted (iOS). Android: NPA false (UMP gates).
  const npa = shouldRequestNonPersonalizedAdsOnly();
  if (rewardedAd && rewardedAdNpa !== npa) {
    rewardedAd = null;
    isLoaded = false;
  }

  if (!rewardedAd) {
    rewardedAdNpa = npa;
    rewardedAd = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: npa,
      keywords: ['sports', 'water polo', 'fantasy sports'],
    });
  }
  return rewardedAd;
}

/** Assumes Mobile Ads SDK is already initialized. */
function loadRewardedAdIfReady() {
  if (!ADS_ENABLED || !initPromise) {
    return;
  }

  const ad = ensureRewardedInstance();
  if (!ad || isLoaded) {
    return;
  }

  const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    isLoaded = true;
    unsubLoaded();
    unsubError();
  });
  const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
    isLoaded = false;
    console.warn('[ads] rewarded load error:', error?.message || error);
    unsubLoaded();
    unsubError();
  });

  try {
    ad.load();
  } catch (err) {
    console.warn('[ads] rewarded load threw:', err?.message || err);
    unsubLoaded();
    unsubError();
  }
}

/**
 * Preload a rewarded ad. No-ops unless consent allows and SDK is ready.
 */
export async function preloadRewardedAd() {
  if (!ADS_ENABLED) {
    return;
  }

  const started = await startAdsIfAllowed({ preload: false });
  if (!started.ok) {
    return;
  }

  loadRewardedAdIfReady();
}

/**
 * Show a rewarded ad. Resolves when the ad closes (or fails).
 * @returns {Promise<{ rewarded: boolean, reward?: { type: string, amount: number }, error?: string }>}
 */
export function showRewardedAd() {
  return new Promise(async (resolve) => {
    if (!ADS_ENABLED) {
      resolve({ rewarded: false, error: 'Ads are disabled.' });
      return;
    }

    const started = await startAdsIfAllowed({ preload: false });
    if (!started.ok) {
      if (started.reason === 'consent_blocked') {
        resolve({
          rewarded: false,
          error:
            'Ads are not available with your current privacy choices. You can change them in Profile → Privacy choices.',
        });
        return;
      }
      resolve({ rewarded: false, error: 'Ads failed to initialize.' });
      return;
    }

    if (!(await canRequestAdsNow())) {
      resolve({
        rewarded: false,
        error:
          'Ads are not available with your current privacy choices. You can change them in Profile → Privacy choices.',
      });
      return;
    }

    const unitId = getRewardedAdUnitId();
    if (!unitId) {
      resolve({
        rewarded: false,
        error:
          'No production rewarded ad unit ID configured. Paste it in config/adsConfig.js (dev builds use Google demo IDs automatically).',
      });
      return;
    }

    const ad = ensureRewardedInstance();
    if (!ad) {
      resolve({ rewarded: false, error: 'Could not create rewarded ad.' });
      return;
    }

    let earnedReward = null;
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      isLoaded = false;
      setTimeout(() => {
        preloadRewardedAd();
      }, 500);
      resolve(result);
    };

    const unsubs = [];
    const cleanup = () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {
          // ignore
        }
      });
    };

    unsubs.push(
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        earnedReward = reward;
      })
    );
    unsubs.push(
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        finish({
          rewarded: !!earnedReward,
          reward: earnedReward
            ? { type: earnedReward.type, amount: earnedReward.amount }
            : undefined,
        });
      })
    );
    unsubs.push(
      ad.addAdEventListener(AdEventType.ERROR, (error) => {
        finish({
          rewarded: false,
          error: error?.message || 'Ad failed.',
        });
      })
    );

    const tryShow = () => {
      ad.show().catch((err) => {
        finish({
          rewarded: false,
          error: err?.message || 'Could not show ad.',
        });
      });
    };

    if (isLoaded) {
      tryShow();
      return;
    }

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      isLoaded = true;
      unsubLoaded();
      tryShow();
    });
    unsubs.push(unsubLoaded);

    try {
      ad.load();
    } catch (err) {
      finish({
        rewarded: false,
        error: err?.message || 'Could not load ad.',
      });
    }
  });
}

export function isUsingTestAds() {
  return __DEV__ || !PRODUCTION_REWARDED_AD_UNIT_ID;
}
