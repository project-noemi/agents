/**
 * Shared provider fallback utility.
 *
 * Retry behavior belongs to gateway.js (withRetry from
 * scripts/resilience_helpers.js).
 * This utility is responsible only for switching to the
 * next configured provider after a provider-availability error.
 *
 * Fallback-worthy errors (after gateway.js's retries are exhausted):
 *   - 429: rate limited
 *   - 5xx: provider/server failure
 *   - TypeError: fetch failed (network failure)
 *   - TimeoutError: request timed out
 *
 * PROVIDER_CONFIG and PROVIDER_EMPTY are never fallback-worthy: bad setup
 * and blocked/empty responses fail closed.
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

// Own properties only. `typeof providers[name] === "function"` is also true
// for inherited methods (toString, constructor), and calling those is not a
// provider run.
export function isRegisteredProvider(providers, name) {
  return typeof name === 'string'
    && name.length > 0
    && providers !== null
    && typeof providers === 'object'
    && Object.hasOwn(providers, name)
    && typeof providers[name] === 'function';
}

/**
 * The ordered, de-duplicated provider chain. Throws code PROVIDER before any
 * provider runs if a name is unknown -- a typo in NOEMI_FALLBACK_PROVIDERS
 * must not surface only after the preferred provider has already failed.
 */
export function providerOrder({ preferred, fallbacks = [], providers }) {
  if (!providers || typeof providers !== 'object') {
    throw new Error('No providers were supplied.');
  }

  const order = [...new Set([preferred, ...fallbacks].filter(Boolean))];
  const unknown = order.filter((name) => !isRegisteredProvider(providers, name));
  if (unknown.length) {
    const err = new Error(
      `Unknown provider${unknown.length > 1 ? 's' : ''} ${unknown.map((n) => `"${n}"`).join(', ')}. ` +
      `Known: ${Object.keys(providers).join(', ')}.`
    );
    err.code = 'PROVIDER';
    throw err;
  }
  if (!order.length) {
    const err = new Error('No available providers could handle the request.');
    err.code = 'PROVIDER';
    throw err;
  }
  return order;
}

export async function runWithFallbacks({
  preferred,
  fallbacks = [],
  providers,
  input,
  onFallback,
  onToken,
}) {
  const order = providerOrder({ preferred, fallbacks, providers });

  let lastFallbackError = null;
  let outputStarted = false;

  for (const providerName of order) {
    try {
      return await providers[providerName](input, (chunk) => {
        if (typeof chunk !== "string" || chunk.length === 0) return;
        outputStarted = true;
        onToken?.(chunk);
      });
    } catch (error) {
      // Once a token is visible to the caller, switching providers would mix
      // answers and misrepresent provenance. Surface the failure instead.
      if (outputStarted || !isFallbackError(error)) throw error;
      lastFallbackError = error;
      onFallback?.({ provider: providerName, error });
    }
  }

  throw lastFallbackError;
}
