
/**
 * Shared plumbing for every provider that calls NewPush's generative AI
 * gateway: error shapes, call-time config (key, origin, timeout, retry), and
 * POST helpers with exponential backoff.
 *
 * Config is read from process.env at CALL time -- never from a .env file
 * (AGENTS.md section Secrets & Configuration). The virtual key is a NewPush
 * credential sent as a Bearer token, never in a URL.
 *
 * Retry vs fallback: retry 429 / 5xx / network failures on the SAME provider
 * with backoff. Once retries are exhausted, fallback.js can switch providers.
 * Timeouts are not retried. Streaming requests must not retry after emitting
 * output, because doing so could duplicate or corrupt the response.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { withRetry } = require("../../../../scripts/resilience_helpers.js");

export const DEFAULT_GATEWAY = "https://ai-gw.newpush.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 1_000;
const RETRY_MAX_DELAY_MS = 8_000;

/**
 * Bad configuration (missing key, bad URL, bad number).
 * These errors are deliberately not fallback-worthy.
 */
export function configError(message) {
  const err = new Error(message);
  err.code = "PROVIDER_CONFIG";
  return err;
}

/**
 * Provider-side HTTP failure.
 * Fallback policy reads err.status directly.
 */
export function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * The provider returned no usable text or blocked/filtered the response.
 * These errors are not fallback-worthy unless explicitly marked otherwise.
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
    throw configError(
      `${name} must be a whole number >= ${min}; got "${raw}".`
    );
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

  // Never send the virtual key over plain HTTP to a remote host.
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && local)
  ) {
    throw configError(
      `AI_GW_BASE_URL must use https (http only for localhost); got "${raw}".`
    );
  }

  if (url.search || url.hash || url.username || url.password) {
    throw configError(
      "AI_GW_BASE_URL must be a bare origin/path with no query, fragment, or credentials."
    );
  }

  return url.href.replace(/\/+$/, "");
}

/**
 * Resolve and validate gateway config.
 * Throws PROVIDER_CONFIG before a request is made.
 *
 * @param {{ timeoutVar: string }} opts Provider-specific timeout variable.
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

// Retry only structured HTTP statuses and undici's fetch failure.
// Timeouts and other errors are not retried.
function isRetryable(err) {
  // Retrying after output was emitted could duplicate or corrupt it.
  if (err?.noFallback) return false;

  if (Number.isInteger(err?.status)) {
    return err.status === 429 || (err.status >= 500 && err.status < 600);
  }

  return err?.name === "TypeError" && err.message === "fetch failed";
}

/**
 * Run an attempt under the shared gateway retry policy.
 *
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
 * POST JSON to the gateway with backoff and return the parsed response body.
 *
 * @param {string} url
 * @param {object} body
 * @param {ReturnType<typeof loadGatewayConfig>} config
 * @param {string} label Provider name for error messages.
 */
export async function postJson(url, body, config, label) {
  const attempt = async () => {
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
      throw httpError(
        `NewPush AI gateway (${label}) returned unparseable JSON.`,
        502
      );
    }
  };

  return withGatewayRetry(attempt, config);
}

/**
 * POST to the gateway and consume a Server-Sent Events (SSE) response.
 *
 * The callback receives each parsed JSON event and a markEmitted() function.
 * Providers call markEmitted() immediately before delivering text to their
 * onToken callback. If anything fails after output has been emitted, the
 * error is marked noFallback so neither retries nor provider fallback can
 * duplicate the already-delivered output.
 *
 * @param {string} url
 * @param {object} body
 * @param {ReturnType<typeof loadGatewayConfig>} config
 * @param {string} label Provider name for error messages.
 * @param {(event: object, markEmitted: () => void) => void | Promise<void>} onEvent
 */
export async function postSse(url, body, config, label, onEvent) {
  const attempt = async () => {
    let emitted = false;

    const markEmitted = () => {
      emitted = true;
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
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

      if (!response.body) {
        throw httpError(
          `NewPush AI gateway (${label}) returned an empty SSE body.`,
          502
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let dataLines = [];

      const dispatch = async () => {
        if (dataLines.length === 0) return;

        const data = dataLines.join("\n");
        dataLines = [];

        // OpenAI-compatible streams commonly terminate with this marker.
        if (data.trim() === "[DONE]") return;

        let event;

        try {
          event = JSON.parse(data);
        } catch {
          throw httpError(
            `NewPush AI gateway (${label}) returned invalid SSE JSON.`,
            502
          );
        }

        await onEvent(event, markEmitted);
      };

      const processLine = async (line) => {
        // Accommodate CRLF streams.
        if (line.endsWith("\r")) {
          line = line.slice(0, -1);
        }

        // A blank line ends an SSE event.
        if (line === "") {
          await dispatch();
          return;
        }

        // SSE comments are keep-alive messages, not events.
        if (line.startsWith(":")) return;

        if (line.startsWith("data:")) {
          let value = line.slice("data:".length);

          // The SSE format permits one optional leading space.
          if (value.startsWith(" ")) {
            value = value.slice(1);
          }

          dataLines.push(value);
        }
      };

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;

        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          await processLine(line);
        }
      }

      buffer += decoder.decode();

      // Process a final line even if the stream did not end with a newline.
      if (buffer.length > 0) {
        await processLine(buffer);
      }

      // Some servers omit the final blank line before closing the stream.
      await dispatch();
    } catch (err) {
      if (emitted && err && typeof err === "object") {
        err.noFallback = true;
      }

      throw err;
    }
  };

  return withGatewayRetry(attempt, config);
}
