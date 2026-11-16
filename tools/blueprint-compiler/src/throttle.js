/**
 * Sliding-window request throttle. One window for the whole server: Studio has a
 * single shared bearer token, so there is no per-user key to count against.
 * Pure and clock-injected, so tests never sleep.
 *
 * @param {{ max: number, windowMs: number, now?: () => number }} opts
 */
export function createThrottle({ max, windowMs, now = Date.now }) {
  const hits = [];
  return {
    /** Counts the request when it is allowed. */
    take() {
      const t = now();
      while (hits.length && hits[0] <= t - windowMs) hits.shift();
      if (hits.length >= max) {
        return { ok: false, retryAfterMs: Math.max(1, hits[0] + windowMs - t) };
      }
      hits.push(t);
      return { ok: true, retryAfterMs: 0 };
    },
  };
}
