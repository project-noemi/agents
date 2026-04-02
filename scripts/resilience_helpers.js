#!/usr/bin/env node
/**
 * resilience_helpers.js
 * Standardized exponential backoff utility for Node.js agents and tools.
 * Satisfies REQUIREMENTS.md resilience mandate (Exponential Backoff pattern).
 *
 * Usage:
 *   const { withRetry } = require('./resilience_helpers');
 *   const result = await withRetry(() => fetch('https://api.example.com'), { maxRetries: 5 });
 */

/**
 * Execute an async function with exponential backoff retry logic.
 * @param {Function} fn - Async function to execute
 * @param {Object} options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 5)
 * @param {number} options.baseDelayMs - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelayMs - Maximum delay cap in ms (default: 30000)
 * @param {number} options.jitterFactor - Jitter multiplier 0-1 (default: 0.2)
 * @param {Function} options.retryIf - Predicate: (err) => bool, default retries all errors
 * @returns {Promise<*>}
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 5,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitterFactor = 0.2,
    retryIf = () => true,
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries || !retryIf(err)) {
        throw err;
      }
      const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = exponentialDelay * jitterFactor * Math.random();
      const delay = Math.round(exponentialDelay + jitter);
      console.warn(`[resilience] Attempt ${attempt + 1}/${maxRetries} failed: ${err.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { withRetry, sleep };
