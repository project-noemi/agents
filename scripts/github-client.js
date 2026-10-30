'use strict';

/**
 * Shared GitHub REST helper with the fleet retry contract
 * (Decision [2026-08-17-0002]).
 *
 * Retry classification keys on the structured `status` property, never on
 * the message text (the body can quote attacker-influencable input).
 *
 * Which METHODS retry matters as much as which statuses: a 5xx or a dropped
 * connection on a POST does not say whether GitHub applied the write. A
 * blind retry posted duplicate comments, turned the loop's own branch
 * creation into a false `head-exists`, and left label syncs half-applied.
 * So by default only GET/HEAD retry on 5xx/network errors. A rate-limit
 * rejection (429, or a 403 that GitHub marks as a rate limit) means the
 * request was NOT processed, so every method retries on those, after the
 * wait GitHub asks for. A caller whose write is safe to repeat (content-
 * addressed git objects, or a create whose 422 it resolves) opts in with
 * `{ idempotent: true }`.
 *
 * `GH_API` stays the github.com constant: scripts/review-pr.js builds the
 * fleet sentinel/compliance URLs from it and those must always hit
 * github.com. GitHub Enterprise Server is supported only by callers that
 * pass `apiBase` explicitly (the coding loop, via githubApiBase(env)).
 */

const { withRetry } = require('./resilience_helpers.js');

const GITHUB_DOTCOM_API = 'https://api.github.com';
const GH_API = GITHUB_DOTCOM_API;
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD']);
const MAX_RATE_LIMIT_WAIT_MS = 60000;

/**
 * API base for callers that may run against GitHub Enterprise Server.
 * Actions sets GITHUB_API_URL on every runner (github.com included). Only an
 * https URL is accepted: a plain-http or junk value would send the token in
 * clear or to an arbitrary scheme, so it falls back to github.com.
 */
function githubApiBase(env = process.env) {
  const raw = String((env && env.GITHUB_API_URL) || '').trim().replace(/\/+$/, '');
  if (!raw) return GITHUB_DOTCOM_API;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return GITHUB_DOTCOM_API;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    return GITHUB_DOTCOM_API;
  }
  return raw;
}

function isRateLimitStatus(err) {
  return Boolean(err) && (err.status === 429 || (err.status === 403 && err.rateLimited === true));
}

function isTransientGitHubError(err) {
  if (err && Number.isInteger(err.status)) {
    if (err.status === 403) return err.rateLimited === true;
    return err.status === 429 || (err.status >= 500 && err.status < 600);
  }
  return Boolean(err) && err.name === 'TypeError';
}

/** Method-aware retry decision (see the module comment). */
function shouldRetryGitHubError(err, { method = 'GET', idempotent = false } = {}) {
  if (!isTransientGitHubError(err)) return false;
  if (isRateLimitStatus(err)) return true;
  return idempotent === true || IDEMPOTENT_METHODS.has(String(method).toUpperCase());
}

function headerOf(res, name) {
  const headers = res && res.headers;
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] || headers[name.toLowerCase()] || null;
}

/**
 * A 403 is a rate limit only when GitHub says so: x-ratelimit-remaining: 0,
 * a Retry-After header, or GitHub's own rate-limit message in the JSON
 * `message` field (secondary limits come back as 403 with that message).
 */
function looksRateLimited(res, text) {
  const retryAfter = headerOf(res, 'retry-after');
  if (retryAfter !== null && retryAfter !== undefined) return true;
  if (String(headerOf(res, 'x-ratelimit-remaining')) === '0') return true;
  let message = '';
  try {
    const parsed = JSON.parse(text);
    message = parsed && typeof parsed.message === 'string' ? parsed.message : '';
  } catch {
    return false;
  }
  return /^(?:You have exceeded a secondary rate limit|API rate limit exceeded)/i.test(message);
}

/**
 * When the primary quota is spent (x-ratelimit-remaining: 0) and the reset is
 * further out than the longest wait we are willing to sleep, waiting the cap
 * and retrying only burns attempts on certain 403s/429s. Returns the reset
 * time (ms epoch) in that case so gh() can fail fast; null otherwise.
 */
function exhaustedUntil(res, { now = Date.now(), cap = MAX_RATE_LIMIT_WAIT_MS } = {}) {
  if (String(headerOf(res, 'x-ratelimit-remaining')) !== '0') return null;
  const retryAfter = headerOf(res, 'retry-after');
  if (retryAfter !== null && retryAfter !== undefined) return null;
  const reset = String(headerOf(res, 'x-ratelimit-reset') || '').trim();
  if (!/^\d+$/.test(reset)) return null;
  const at = Number(reset) * 1000;
  return at - now > cap ? at : null;
}

/**
 * GitHub's guidance for a secondary limit with no Retry-After is to wait at
 * least a minute; retrying on the short exponential schedule extends the
 * block instead. GITHUB_SECONDARY_RATE_FLOOR_MS (or the option) lowers it in
 * tests.
 */
function secondaryRateFloorMs() {
  const raw = Number(process.env.GITHUB_SECONDARY_RATE_FLOOR_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 60000;
}

/** Wait GitHub asked for, in ms, capped. null when the response names none. */
function rateLimitWaitMs(res, { now = Date.now(), cap = MAX_RATE_LIMIT_WAIT_MS } = {}) {
  const retryAfter = headerOf(res, 'retry-after');
  if (retryAfter !== null && retryAfter !== undefined && /^\d+$/.test(String(retryAfter).trim())) {
    return Math.min(Number(retryAfter) * 1000, cap);
  }
  const reset = headerOf(res, 'x-ratelimit-reset');
  if (String(headerOf(res, 'x-ratelimit-remaining')) === '0' && /^\d+$/.test(String(reset || '').trim())) {
    return Math.min(Math.max(Number(reset) * 1000 - now, 0), cap);
  }
  return null;
}

async function gh(path, {
  token,
  accept = 'application/vnd.github+json',
  method = 'GET',
  body,
  idempotent = false,
  apiBase = GH_API,
  fetchImpl,
  maxWaitMs = MAX_RATE_LIMIT_WAIT_MS,
  secondaryFloorMs = secondaryRateFloorMs(),
} = {}) {
  const base = String(apiBase || GH_API).replace(/\/+$/, '');
  return withRetry(async () => {
    // Read global fetch at call time so tests can stub it.
    const doFetch = fetchImpl || globalThis.fetch;
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: {
        Accept: accept,
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text();
      const error = new Error(`GitHub ${method} ${path} → ${res.status} ${text}`);
      error.status = res.status;
      if (res.status === 403 || res.status === 429) {
        error.rateLimited = res.status === 429 || looksRateLimited(res, text);
        const until = error.rateLimited ? exhaustedUntil(res, { cap: maxWaitMs }) : null;
        if (until !== null) {
          // Not retried (see exhaustedUntil); the message says when to come back.
          const limited = new Error(`GitHub ${method} ${path} → ${res.status} rate-limited until ${new Date(until).toISOString()}`);
          limited.status = res.status;
          limited.rateLimited = true;
          limited.rateLimitExhausted = true;
          limited.rateLimitResetAt = until;
          throw limited;
        }
        const wait = rateLimitWaitMs(res, { cap: maxWaitMs });
        if (wait !== null) error.retryAfterMs = wait;
        else if (res.status === 403 && error.rateLimited) error.retryAfterMs = secondaryFloorMs;
      }
      throw error;
    }
    if (res.status === 204) return null;
    return accept.includes('diff') ? res.text() : res.json();
  }, {
    maxRetries: 4,
    baseDelayMs: Number(process.env.GITHUB_RETRY_BASE_MS || process.env.REVIEW_RETRY_BASE_MS || 2000),
    maxDelayMs: 20000,
    retryIf: (err) => !(err && err.rateLimitExhausted) && shouldRetryGitHubError(err, { method, idempotent }),
    // GitHub's own wait (Retry-After / x-ratelimit-reset), capped; otherwise
    // the exponential schedule.
    delayFor: (err) => (err && Number.isFinite(err.retryAfterMs)
      ? Math.min(Math.max(err.retryAfterMs, 0), maxWaitMs)
      : undefined),
  });
}

module.exports = {
  GH_API,
  GITHUB_DOTCOM_API,
  MAX_RATE_LIMIT_WAIT_MS,
  exhaustedUntil,
  gh,
  githubApiBase,
  isTransientGitHubError,
  rateLimitWaitMs,
  shouldRetryGitHubError,
};
