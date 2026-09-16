'use strict';

/**
 * Shared provider fallback utility.
 *
 * This utility does not know anything about Gemini, Grok, or Mock.
 * The caller supplies the providers and the order in which they
 * should be attempted.
 *
 * Example:
 *
 * runWithFallbacks({
 *   preferred: 'gemini',
 *   fallbacks: ['mock'],
 *   providers: {
 *     gemini: () => callGemini(),
 *     mock: () => callMock(),
 *   },
 *  input is temp incase we want to pass parameter into the function calls of providers
 * });
 *
 * The fallback list is intentionally supplied by the caller.
 * A future IR / compile layer can provide that policy later.
 */
async function runWithFallbacks({
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

  let lastError = null;

  for (const providerName of order) {
    const provider = providers[providerName];

    // Provider is configured in the policy but unavailable
    // in the current environment.
    if (typeof provider !== 'function') {
      continue;
    }

    try {
      return await provider(input);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    'No available providers could handle the request.'
  );
}

module.exports = {
  runWithFallbacks,
};