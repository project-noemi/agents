/**
 * Shared plumbing for every provider that calls NewPush's generative AI
 * gateway: error shapes, call-time config (key, origin, timeout, retry), and
 * one POST helper with exponential backoff.
 *
 * Config is read from process.env at CALL time -- never from a .env file
 * (AGENTS.md section Secrets & Configuration). The virtual key is a NewPush
 * credential sent as a Bearer token, never in a URL.
 *
 * Retry vs fallback: postJson() retries 429 / 5xx / network failures on the
 * SAME provider with backoff (scripts/resilience_helpers.js). Only once those
 * retries are exhausted does the error reach fallback.js, which switches to
 * the next provider. Timeouts are not retried (a hung gateway would multiply
 * the wait); they go straight to fallback.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// src/providers/ -> src/ -> blueprint-compiler/ -> tools/ -> repo root.
const { withRetry } = require("../../../../scripts/resilience_helpers.js");

export const DEFAULT_GATEWAY = "https://ai-gw.newpush.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 1_000;
const RETRY_MAX_DELAY_MS = 8_000;

/**
 * Bad configuration (missing key, bad URL, bad number). Deliberately carries
 * no `status` and isn't a TypeError, so fallback.js's isFallbackError()
 * treats it as NOT fallback-worthy -- a setup problem should fail closed
 * rather than silently degrade to another provider.
 */
export function configError(message) {
  const err = new Error(message);
  err.code = "PROVIDER_CONFIG";
  return err;
}

/**
 * Provider-side failure with an HTTP status. fallback.js's isFallbackError()
 * reads err.status directly: 429 and 5xx are fallback-worthy, everything
 * else (401 bad key, 403 model not allowed or budget exhausted) is not.
 */
export function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * The provider answered 200 but produced nothing usable: no text, or the
 * response was blocked / filtered. Not fallback-worthy: a blocked prompt
 * must fail closed, not be retried on a provider with a looser filter.
 */
export function emptyError(message) {
  const err = new Error(message);
  err.code = "PROVIDER_EMPTY";
  return err;
}

// Unset or blank -> fallback. Anything else must be a whole number >= min.
function readInt(env, name, fallback, min) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) {
    throw configError(`${name} must be a whole number >= ${min}; got "${raw}".`);
  }
  return n;
}

function readGateway(env) {
  const raw = env.AI_GW_BASE_URL?.trim() || DEFAULT_GATEWAY;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw configError(`AI_GW_BASE_URL is not a valid URL: "${raw}".`);
  }
  // The key goes out as a Bearer header: never over plain HTTP to a remote host.
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw configError(`AI_GW_BASE_URL must use https (http only for localhost); got "${raw}".`);
  }
  if (url.search || url.hash || url.username || url.password) {
    throw configError("AI_GW_BASE_URL must be a bare origin/path with no query, fragment, or credentials.");
  }
  return url.href.replace(/\/+$/, "");
}

/**
 * Resolve and validate gateway config. Throws PROVIDER_CONFIG on any problem,
 * before a single request is made -- compile.js calls this up front for every
 * live provider in the chain.
 * @param {{ timeoutVar: string }} opts provider-specific timeout variable
 */
export function loadGatewayConfig({ timeoutVar }, env = process.env) {
  const apiKey = env.AI_GW_API_KEY?.trim();
  if (!apiKey) {
    throw configError(
      "AI_GW_API_KEY is not set. Inject the NewPush AI gateway virtual key at " +
        "runtime via `infisical run` or `op run` -- see AGENTS.md. Never place " +
        "it in a .env file."
    );
  }
  return {
    apiKey,
    gateway: readGateway(env),
    timeoutMs: readInt(env, timeoutVar, DEFAULT_TIMEOUT_MS, 1),
    maxRetries: readInt(env, "AI_GW_MAX_RETRIES", DEFAULT_MAX_RETRIES, 0),
    retryBaseMs: readInt(env, "AI_GW_RETRY_BASE_MS", DEFAULT_RETRY_BASE_MS, 0),
  };
}

// Same rule as coding-loop/http.js: retry on structured status, never on
// message text. Network failures are undici's TypeError("fetch failed").
function isRetryable(err) {
  if (Number.isInteger(err?.status)) {
    return err.status === 429 || (err.status >= 500 && err.status < 600);
  }
  return err?.name === "TypeError" && err.message === "fetch failed";
}

/**
 * Run one attempt function under the gateway's retry policy (429 / 5xx /
 * network failure, exponential backoff, config from loadGatewayConfig). Shared
 * by postJson() and the Mastra runtime so there is exactly one retry policy:
 * the attempt must throw errors that carry `.status` (or undici's
 * TypeError("fetch failed")) for them to be retried.
 * @template T
 * @param {() => Promise<T>} attempt
 * @param {ReturnType<typeof loadGatewayConfig>} config
 * @returns {Promise<T>}
 */
export function withGatewayRetry(attempt, config) {
  return withRetry(attempt, {
    maxRetries: config.maxRetries,
    baseDelayMs: config.retryBaseMs,
    maxDelayMs: RETRY_MAX_DELAY_MS,
    retryIf: isRetryable,
    // compile.js never logs; the CLI owns stderr for its audit record.
    onRetry: () => {},
  });
}

/**
 * POST JSON to the gateway with backoff, and return the parsed body.
 * @param {string} url
 * @param {object} body
 * @param {ReturnType<typeof loadGatewayConfig>} config
 * @param {string} label provider name for error messages
 */
export async function postJson(url, body, config, label) {
  const attempt = async () => {
    // Fresh timeout signal per attempt: one shared signal would already be
    // spent by the time a retry ran.
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw httpError(
        `NewPush AI gateway (${label}) returned ${response.status}: ${text.slice(0, 300)}`,
        response.status
      );
    }

    try {
      return await response.json();
    } catch {
      // A 200 with a body we can't read is a bad gateway, not a pass.
      throw httpError(`NewPush AI gateway (${label}) returned unparseable JSON.`, 502);
    }
  };

  return withGatewayRetry(attempt, config);
}
