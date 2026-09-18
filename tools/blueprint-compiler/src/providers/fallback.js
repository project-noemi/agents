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
 *   - TypeError: network/fetch failure
 *
 * Other errors are thrown immediately because they generally
 * represent bad configuration, invalid input, validation errors,
 * or programming errors rather than temporary provider failure.
 */

export function isFallbackError(err) {
  if (!err) return false;

  if (Number.isInteger(err.status)) {
    if (err.status === 429) return true;

    if (err.status >= 500 && err.status < 600) {
      return true;
    }
  }

  return err.name === 'TypeError';
}

export async function runWithFallbacks({
  preferred,
  fallbacks = [],
  providers,
  input,
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

    // The policy can name a provider that is not configured
    // in the current environment. Skip it and continue.
    if (typeof provider !== 'function') {
      continue;
    }

    try {
      return await provider(input);
    } catch (error) {
      if (!isFallbackError(error)) {
        throw error;
      }

      lastFallbackError = error;
    }
  }

  if (lastFallbackError) {
    throw lastFallbackError;
  }

  throw new Error(
    'No available providers could handle the request.'
  );
}
