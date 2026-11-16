const WINDOW_MS = 60_000;

/**
 * Fixed one-minute window for the whole server. Studio has one operator, so it
 * counts requests in total and keeps no per-client state, which also means no
 * client address is ever stored.
 * @param {number} limit requests allowed per window
 * @param {() => number} [now] clock, for tests
 * @returns {() => number} take one slot: 0 if allowed, else seconds until the window resets
 */
export function createRateLimiter(limit, now = Date.now) {
  let windowStart = now();
  let used = 0;

  return () => {
    const at = now();
    if (at - windowStart >= WINDOW_MS) {
      windowStart = at;
      used = 0;
    }
    if (used >= limit) return Math.ceil((windowStart + WINDOW_MS - at) / 1000);
    used += 1;
    return 0;
  };
}
