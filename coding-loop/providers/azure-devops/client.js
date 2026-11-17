'use strict';

/**
 * Azure DevOps REST client for the coding-loop provider.
 *
 * The retry contract mirrors scripts/github-client.js (Decision
 * [2026-10-27-0003]) because the failure it prevents is the same: a 5xx or
 * a dropped connection on a write does not say whether the write landed.
 *   - GET/HEAD retry on 5xx and network errors.
 *   - A write retries on 5xx only when the caller passes `idempotent: true`
 *     (a create-only ref push, a rev-guarded PATCH, a create whose conflict
 *     the caller resolves). Comments never do.
 *   - 429 means "not processed", so any method retries after Retry-After
 *     (capped at 60 s).
 *
 * Azure DevOps throttles BEFORE it rejects: a 200 can carry `Retry-After`
 * (plus X-RateLimit-* headers) to say "you are being delayed, slow down".
 * The successful call is not retried; the client sleeps that long before
 * its NEXT request, so a run that ignores the hint does not walk into a
 * TF400733 429.
 *
 * Errors never carry a credential: the Authorization header is never echoed,
 * the body is cut to 400 characters and redacted, and the URL query is
 * dropped from the message.
 */

const { withRetry, sleep: realSleep } = require('../../../scripts/resilience_helpers.js');
const { providerError } = require('../contract.js');

const ADO_CLOUD_BASE = 'https://dev.azure.com';
const ADO_VSSPS_CLOUD_BASE = 'https://vssps.dev.azure.com';
const MAX_RATE_LIMIT_WAIT_MS = 60000;
const ERROR_BODY_CHARS = 400;
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD']);

/**
 * An https base with no credentials, query or fragment. A junk value is a
 * configuration error and is refused: falling back to dev.azure.com would
 * send an Azure DevOps Server credential to the cloud.
 */
function httpsBase(raw, name) {
  const text = String(raw || '').trim().replace(/\/+$/, '');
  let url;
  try {
    url = new URL(text.replace('{org}', 'org'));
  } catch {
    throw providerError(`${name} is not a valid URL.`, 400, 'ado-bad-base-url');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw providerError(`${name} must be an https URL without credentials, query or fragment.`, 400, 'ado-bad-base-url');
  }
  return text;
}

/**
 * Organization URL root. ADO_BASE_URL overrides dev.azure.com for Azure
 * DevOps Server (`https://tfs.example.com/tfs` → `/tfs/{collection}`) or a
 * legacy host; `{org}` in it is substituted (`https://{org}.visualstudio.com`).
 */
function orgUrl(org, env = process.env) {
  const raw = env && env.ADO_BASE_URL;
  const base = raw ? httpsBase(raw, 'ADO_BASE_URL') : ADO_CLOUD_BASE;
  const segment = encodeURIComponent(String(org));
  return base.includes('{org}') ? base.replace('{org}', segment) : `${base}/${segment}`;
}

/**
 * Graph and Identities live on vssps.dev.azure.com in the cloud and on the
 * collection URL on Azure DevOps Server. ADO_VSSPS_BASE_URL overrides.
 */
function vsspsUrl(org, env = process.env) {
  if (env && env.ADO_VSSPS_BASE_URL) {
    const base = httpsBase(env.ADO_VSSPS_BASE_URL, 'ADO_VSSPS_BASE_URL');
    const segment = encodeURIComponent(String(org));
    return base.includes('{org}') ? base.replace('{org}', segment) : `${base}/${segment}`;
  }
  if (env && env.ADO_BASE_URL) return orgUrl(org, env);
  return `${ADO_VSSPS_CLOUD_BASE}/${encodeURIComponent(String(org))}`;
}

/** Host the RepoRef records (and the only URL host parseRepo accepts besides the cloud ones). */
function baseHost(env = process.env) {
  if (!env || !env.ADO_BASE_URL) return 'dev.azure.com';
  try {
    return new URL(httpsBase(env.ADO_BASE_URL, 'ADO_BASE_URL').replace('{org}', 'org')).host.toLowerCase();
  } catch {
    return null;
  }
}

function headerOf(res, name) {
  const headers = res && res.headers;
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] || headers[name.toLowerCase()] || null;
}

/** Retry-After in ms (delta-seconds only), capped; null when absent or unparseable. */
function retryAfterMs(res, { cap = MAX_RATE_LIMIT_WAIT_MS } = {}) {
  const raw = headerOf(res, 'retry-after');
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  return Math.min(Math.round(Number(text) * 1000), cap);
}

/**
 * Remove anything credential-shaped from text that may be logged: auth
 * headers, JWTs, long opaque runs (PATs are 52-84 base32/base64 chars), and
 * any exact secret the caller knows.
 */
function redact(text, secrets = []) {
  let out = String(text || '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 8) out = out.split(secret).join('[redacted]');
  }
  return out
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, '[redacted-jwt]')
    .replace(/[A-Za-z0-9+/_-]{40,}={0,2}/g, '[redacted]');
}

/** TFxxxxxx code from an Azure DevOps error body, or null. */
function tfCodeOf(text) {
  const match = /\b(TF\d{5,6})\b/.exec(String(text || ''));
  return match ? match[1] : null;
}

function isTransient(err) {
  if (err && Number.isInteger(err.status)) return err.status === 429 || (err.status >= 500 && err.status < 600);
  return Boolean(err) && err.name === 'TypeError';
}

function shouldRetry(err, { method = 'GET', idempotent = false } = {}) {
  if (!isTransient(err)) return false;
  if (err && err.status === 429) return true;
  return idempotent === true || IDEMPOTENT_METHODS.has(String(method).toUpperCase());
}

/** Authorization header value for an opaque provider credential. */
function authorizationFor(cred) {
  if (!cred || typeof cred.token !== 'string' || cred.token === '') return null;
  if (cred.scheme === 'basic') return `Basic ${Buffer.from(`:${cred.token}`).toString('base64')}`;
  return `Bearer ${cred.token}`;
}

/** Path for messages: no query (it can carry continuation tokens and ids). */
function messagePath(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return '[url]';
  }
}

/**
 * @param {object} [opts]
 * @param {Function} [opts.fetchImpl]  fetch; read at call time when omitted so tests can stub it
 * @param {Function} [opts.sleep]      (ms) → Promise; the throttle wait (tests record it)
 * @param {Function} [opts.now]        () → ms epoch
 * @param {number}   [opts.retryBaseMs] exponential base for 5xx/network retries
 * @param {number}   [opts.maxWaitMs]   Retry-After cap
 */
function createAdoClient({
  fetchImpl, sleep = realSleep, now = Date.now, retryBaseMs, maxWaitMs = MAX_RATE_LIMIT_WAIT_MS,
} = {}) {
  const state = { notBefore: 0 };

  async function throttle() {
    const wait = state.notBefore - now();
    if (wait > 0) await sleep(Math.min(wait, maxWaitMs));
  }

  /**
   * One API call. `url` is absolute (callers build it from orgUrl/vsspsUrl
   * with every path segment encoded). Returns parsed JSON, or null for 204.
   * With `raw: true` returns `{ status, headers, body }` and never throws on
   * a non-2xx (entitlement probes read headers of a 401). With
   * `includeHeaders: true` returns `{ data, headers }` (Graph paginates with
   * an `x-ms-continuationtoken` header).
   */
  async function request(url, {
    cred,
    method = 'GET',
    body,
    contentType = 'application/json',
    accept = 'application/json',
    idempotent = false,
    raw = false,
    includeHeaders = false,
  } = {}) {
    const upper = String(method).toUpperCase();
    const authorization = authorizationFor(cred);
    const secrets = cred && typeof cred.token === 'string' ? [cred.token] : [];
    const base = Number(retryBaseMs !== undefined ? retryBaseMs : (process.env.ADO_RETRY_BASE_MS || 2000));
    return withRetry(async () => {
      await throttle();
      const doFetch = fetchImpl || globalThis.fetch;
      const res = await doFetch(url, {
        method: upper,
        // A redirect from an API call is never expected; following one could
        // leave the forge. A 3xx is reported as an error below.
        redirect: 'manual',
        headers: {
          Accept: accept,
          // Without this, a bad credential is a 302 to the sign-in page (or a
          // 203 HTML page) instead of a 401.
          'X-TFS-FedAuthRedirect': 'Suppress',
          ...(authorization ? { Authorization: authorization } : {}),
          ...(body !== undefined ? { 'Content-Type': contentType } : {}),
        },
        ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      });
      const hinted = retryAfterMs(res, { cap: maxWaitMs });
      if (res.ok && hinted !== null && res.status !== 203) {
        // Throttled but served: slow the NEXT call, do not repeat this one.
        state.notBefore = Math.max(state.notBefore, now() + hinted);
      }
      const text = upper === 'HEAD' ? '' : await res.text();
      if (raw) return { status: res.status, headers: res.headers, body: text };
      // 203 is Azure DevOps' "here is a sign-in page" answer to a bad
      // credential; treat it as the 401 it means.
      const status = res.status === 203 ? 401 : res.status;
      if (!res.ok || res.status === 203) {
        const error = new Error(`Azure DevOps ${upper} ${messagePath(url)} → ${status} ${redact(text.slice(0, ERROR_BODY_CHARS), secrets)}`.trim());
        error.status = status;
        const code = tfCodeOf(text);
        if (code) error.code = code;
        if (status === 429) error.retryAfterMs = hinted;
        throw error;
      }
      let data = null;
      if (res.status !== 204 && text !== '') {
        try {
          data = JSON.parse(text);
        } catch {
          throw providerError(`Azure DevOps ${upper} ${messagePath(url)} returned a non-JSON response.`, 502, 'ado-non-json');
        }
      }
      return includeHeaders ? { data, headers: res.headers } : data;
    }, {
      maxRetries: 4,
      baseDelayMs: Number.isFinite(base) ? base : 2000,
      maxDelayMs: 20000,
      retryIf: (err) => shouldRetry(err, { method: upper, idempotent }),
      delayFor: (err) => (err && Number.isFinite(err.retryAfterMs) ? Math.min(Math.max(err.retryAfterMs, 0), maxWaitMs) : undefined),
    });
  }

  return { request, state };
}

module.exports = {
  ADO_CLOUD_BASE,
  ADO_VSSPS_CLOUD_BASE,
  ERROR_BODY_CHARS,
  MAX_RATE_LIMIT_WAIT_MS,
  authorizationFor,
  baseHost,
  createAdoClient,
  headerOf,
  orgUrl,
  redact,
  retryAfterMs,
  shouldRetry,
  tfCodeOf,
  vsspsUrl,
};
