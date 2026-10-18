import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showRewardedAd } from './adsService';

const STORAGE_KEY = '@fwp_scout_access_until';

/** How long one rewarded unlock lasts. */
export const SCOUT_ACCESS_HOURS = 2;
export const SCOUT_ACCESS_MS = SCOUT_ACCESS_HOURS * 60 * 60 * 1000;

/**
 * @returns {Promise<number|null>} Expiry timestamp (ms) or null
 */
export async function getScoutAccessUntil() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const until = Number(raw);
    if (!Number.isFinite(until)) return null;
    return until;
  } catch (err) {
    console.warn('[scoutAccess] read failed:', err?.message || err);
    return null;
  }
}

export async function hasScoutAccess() {
  const until = await getScoutAccessUntil();
  return !!until && Date.now() < until;
}

export async function getScoutAccessRemainingMs() {
  const until = await getScoutAccessUntil();
  if (!until) return 0;
  return Math.max(0, until - Date.now());
}

export async function grantScoutAccess() {
  const until = Date.now() + SCOUT_ACCESS_MS;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(until));
    return { until, error: null };
  } catch (err) {
    console.warn('[scoutAccess] write failed:', err?.message || err);
    return { until: null, error: err };
  }
}

export function formatScoutRemaining(ms) {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Confirm → rewarded ad → grant timed scout access.
 * @returns {Promise<{ ok: boolean }>}
 */
export function promptAndUnlockScoutAccess() {
  return new Promise((resolve) => {
    Alert.alert(
      'Unlock Team Scouting?',
      `Watch a short ad to view other managers' GW squads for ${SCOUT_ACCESS_HOURS} hours.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve({ ok: false }),
        },
        {
          text: 'Watch Ad',
          onPress: async () => {
            const adResult = await showRewardedAd();
            if (adResult.error) {
              Alert.alert('Ad Error', adResult.error);
              resolve({ ok: false });
              return;
            }
            if (!adResult.rewarded) {
              Alert.alert(
                'Ad Not Completed',
                'Watch the full ad to unlock team scouting.'
              );
              resolve({ ok: false });
              return;
            }

            const grant = await grantScoutAccess();
            if (grant.error || !grant.until) {
              Alert.alert(
                'Unlock Failed',
                'Could not save scout access. Please try again.'
              );
              resolve({ ok: false });
              return;
            }

            resolve({ ok: true });
          },
        },
      ]
    );
  });
}

/**
 * Navigate to ViewTeam if allowed (own team / active window / after ad).
 * @param {{ isOwnTeam: boolean, navigate: () => void }} opts
 */
export async function ensureScoutAccessThen(opts) {
  const { isOwnTeam, navigate } = opts;
  if (isOwnTeam) {
    navigate();
    return;
  }
  if (await hasScoutAccess()) {
    navigate();
    return;
  }
  const unlock = await promptAndUnlockScoutAccess();
  if (unlock.ok) {
    navigate();
  }
}
