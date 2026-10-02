/**
 * PostgREST rejects tokens whose `iat` is slightly ahead of the API clock
 * (PGRST303 "JWT issued at future"). Common on cold start / platform JWT
 * incidents when Auth and the Data API clocks drift.
 *
 * Important: do NOT refreshSession() on this error. Mid-skew, newly minted
 * tokens keep failing; waiting and retrying the same session is safer.
 * PostgREST typically allows ~30s of future iat skew.
 */

export const isJwtIssuedAtFutureError = (error) => {
  if (!error) return false;
  const code = error.code ?? error?.error?.code;
  const message = String(error.message ?? error?.error?.message ?? '');
  return code === 'PGRST303' || /JWT issued at future/i.test(message);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Backoff between attempts (ms). Total wait ~17s across 4 attempts. */
const DEFAULT_BACKOFF_MS = [0, 2000, 5000, 10000];

/**
 * Run an async `{ data, error }` fetcher, retrying when PostgREST rejects the
 * JWT as issued in the future. Waits with backoff — does not refresh the session.
 * Non-clock-skew errors are returned immediately (no retry).
 *
 * @param {() => Promise<{data: *, error: *}>} fetchFn
 * @param {{
 *   maxAttempts?: number,
 *   backoffMs?: number[],
 *   onRetry?: (info: { attempt: number, maxAttempts: number, delayMs: number }) => void,
 * }} [options]
 * @returns {Promise<{data: *, error: *}>}
 */
export const withJwtClockSkewRetry = async (
  fetchFn,
  { maxAttempts = 4, backoffMs = DEFAULT_BACKOFF_MS, onRetry } = {}
) => {
  let lastResult = { data: null, error: null };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const delayMs = backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 2000;

    if (attempt > 1) {
      onRetry?.({ attempt, maxAttempts, delayMs });
      console.warn(
        `[auth] JWT issued at future — waiting ${delayMs}ms then retrying ` +
          `(attempt ${attempt}/${maxAttempts}, no session refresh)`
      );
      await sleep(delayMs);
    }

    lastResult = await fetchFn();

    if (!lastResult?.error) {
      return lastResult;
    }

    if (!isJwtIssuedAtFutureError(lastResult.error) || attempt === maxAttempts) {
      return lastResult;
    }
  }

  return lastResult;
};
