/**
 * Shared provider fallback utility.
 *
 * Retry behavior belongs to http.js / withRetry().
 * This utility is responsible only for switching to the
 * next configured provider after a provider-availability error.
 *
 * Fallback-worthy errors:
 *   - 429: rate limited
 *   - 5xx: provider/server failure
 *   - TypeError: fetch failed (network failure)
 *   - TimeoutError: request timed out
 *
 * Other errors are thrown immediately because they generally
 * represent bad configuration, invalid input, validation errors,
 * or programming errors rather than temporary provider failure.
 */

// Node's fetch (undici) reports every connection-level failure -- refused, DNS,
// reset, TLS -- as TypeError("fetch failed"). Other TypeErrors (invalid URL, or a
// plain bug like reading a property of undefined) are ours to fix, not transient.
function isNetworkFailure(err) {
  return err.name === 'TypeError' && err.message === 'fetch failed';
}

export function isFallbackError(err) {
  if (!err) return false;

  if (Number.isInteger(err.status)) {
    if (err.status === 429) return true;
    if (err.status >= 500 && err.status < 600) return true;
  }

  // TimeoutError: AbortSignal.timeout() fired.
  return isNetworkFailure(err) || err.name === 'TimeoutError';
}

export async function runWithFallbacks({
  preferred,
  fallbacks = [],
  providers,
  input,
  onFallback
}) {
  if (!providers || typeof providers !== 'object') {
    throw new Error('No providers were supplied.');
  }

  const order = [
    preferred,
    ...fallbacks,
  ].filter(Boolean);

  let lastFallbackError = null;

    for (const providerName of order) {
    const provider = providers[providerName];
    if (typeof provider !== 'function') continue;

    try {
      return await provider(input);
    } catch (error) {
      if (!isFallbackError(error)) throw error;
      lastFallbackError = error;
      onFallback?.({ provider: providerName, error });
    }
  }

  if (lastFallbackError) throw lastFallbackError; 

  const err = new Error('No available providers could handle the request.');
  err.code = 'PROVIDER';
  throw err;
}
