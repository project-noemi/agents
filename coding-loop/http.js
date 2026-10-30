'use strict';

/**
 * Shared HTTP error helpers for model calls. Classification keys on the
 * structured `status` property, never on message text (Decision [2026-08-17-0003]).
 *
 * A status-less TypeError is transient only when it is a network failure:
 * undici's `fetch failed` (whatever its cause code, since undici and the OS
 * keep adding new ones) or a cause code from NETWORK_CODES. Any other
 * TypeError is a code bug and retrying it five times only hides it. Header,
 * body, and inactivity timeouts and AbortError/TimeoutError are
 * `model-timeout`: an outage, but not retried (it multiplies the wall
 * clock). Connect-level timeouts (ETIMEDOUT, UND_ERR_CONNECT_TIMEOUT) are
 * cheap and do retry.
 */

const NETWORK_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE',
  'ENETUNREACH', 'EHOSTUNREACH', 'ENETDOWN', 'EHOSTDOWN',
  'UND_ERR_SOCKET', 'UND_ERR_CLOSED', 'UND_ERR_CONNECT_TIMEOUT',
]);
const TIMEOUT_NAMES = new Set(['AbortError', 'TimeoutError']);
const TIMEOUT_CODES = new Set([
  'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'MODEL_INACTIVITY_TIMEOUT',
]);
const MAX_RETRY_AFTER_MS = 60000;

function causeCode(err) {
  if (err && err.cause && err.cause.code) return String(err.cause.code);
  return err && typeof err.code === 'string' ? err.code : '';
}

function isTransientHttpError(err) {
  if (err && Number.isInteger(err.status)) {
    return err.status === 429 || (err.status >= 500 && err.status < 600);
  }
  if (!err || err.name !== 'TypeError') return false;
  const code = causeCode(err);
  if (TIMEOUT_CODES.has(code)) return false;
  if (err.cause && TIMEOUT_NAMES.has(err.cause.name)) return false;
  if (NETWORK_CODES.has(code)) return true;
  return err.message === 'fetch failed';
}

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Milliseconds a Retry-After value asks for, or null. Accepts an error that
 * already carries `retryAfterMs` or `headers`, a fetch Headers object, a
 * plain header map, or the raw value. Seconds and HTTP-dates both work.
 */
function retryAfterMs(headersOrErr, now = Date.now()) {
  if (headersOrErr == null) return null;
  if (typeof headersOrErr === 'object' && Number.isFinite(headersOrErr.retryAfterMs)) {
    return Math.max(0, headersOrErr.retryAfterMs);
  }
  let raw = headersOrErr;
  if (typeof raw === 'object') {
    const source = raw.headers && typeof raw.headers === 'object' ? raw.headers : raw;
    if (typeof source.get === 'function') {
      raw = source.get('retry-after');
    } else {
      const key = Object.keys(source).find((name) => name.toLowerCase() === 'retry-after');
      raw = key ? source[key] : null;
    }
  }
  if (Array.isArray(raw)) [raw] = raw;
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Math.round(Number(value) * 1000);
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  return Math.max(0, at - now);
}

function modelRetryOptions() {
  return {
    maxRetries: 4,
    baseDelayMs: Number(process.env.MODEL_RETRY_BASE_MS || process.env.GITHUB_RETRY_BASE_MS || 2000),
    maxDelayMs: 20000,
    retryIf: isTransientHttpError,
    // A 429/503 that names its own wait is honoured (capped), instead of
    // hammering the gateway on the exponential schedule.
    delayFor: (err) => {
      const wait = retryAfterMs(err);
      return wait == null ? undefined : Math.min(wait, MAX_RETRY_AFTER_MS);
    },
  };
}

module.exports = {
  NETWORK_CODES,
  httpError,
  isTransientHttpError,
  modelRetryOptions,
  retryAfterMs,
};
