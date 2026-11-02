'use strict';

/**
 * The one OpenAI-compatible chat call (`POST {base}/chat/completions`) for the
 * NewPush AI gateway and for api.x.ai. Config comes from scripts/model-config.js.
 *
 * TRANSPORT
 *   node:http/https, not global fetch. undici's 300s headersTimeout aborted
 *   large-PR reviews (#428, Decision [2026-08-20-0002]) and cannot be raised
 *   without the undici package. `timeoutMs` is socket inactivity, not a
 *   wall-clock cap. Tests inject `fetchImpl`.
 *
 * NO RETRY HERE
 *   Every caller already wraps its call in withRetry. Errors carry `status`:
 *   429/5xx and fast network failures (as 503) are transient; an inactivity
 *   timeout has no status and is not retried; 401 and 403 are never retried.
 *   A spent budget or a model the key may not call carries
 *   `code: 'budget-or-forbidden'` and `status: 403`. Callers stop; it is not
 *   an outage to re-queue. LiteLLM's status for a spent budget moved across
 *   releases (400, then 429, then 422), so classification reads the error
 *   body's `type`, and the original status stays in `upstreamStatus`. A 429
 *   that is really a budget must not be retried as a rate limit.
 *
 * Only `choices[0].message.content` is parsed. `reasoning_content` is the
 * scratchpad and can hold discarded output (advisory premise on #589).
 */

const http = require('node:http');
const https = require('node:https');

const DEFAULT_TIMEOUT_MS = 600000;
const TIMEOUT_CODES = new Set(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'MODEL_INACTIVITY_TIMEOUT']);

function httpError(message, status, extra = {}) {
  const err = new Error(message);
  if (Number.isInteger(status)) err.status = status;
  return Object.assign(err, extra);
}

function chatTimeoutMs(env = process.env) {
  const n = Number(env.AI_GW_TIMEOUT_MS || env.GEMINI_FETCH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

function redactModelError(text, apiKey) {
  // Strip the key this request sent before any slice. A gateway can echo a
  // token that matches neither sk- nor Bearer (advisory code on #590).
  // Shorter than 8 characters is not treated as a credential: deleting it
  // would blank ordinary words in the error.
  let out = String(text || '');
  const secret = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (secret.length >= 8) out = out.split(secret).join('[redacted]');
  return out
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-REDACTED')
    .replace(/Bearer\s+\S+/gi, 'Bearer REDACTED')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/** One header from a fetch Headers object or a node:http header map. */
function headerValue(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) || '');
  const value = headers[name] != null ? headers[name] : headers[name.toLowerCase()];
  return value == null ? '' : String(Array.isArray(value) ? value[0] : value);
}

function hostOf(apiBase) {
  try {
    return new URL(apiBase).host;
  } catch {
    return '';
  }
}

/**
 * Visible-answer cap and JSON mode. On the gateway, xai/* needs both named in
 * allowed_openai_params or LiteLLM drops them. Other providers must NOT name
 * them: LiteLLM maps both natively for Gemini (and Anthropic), and naming them
 * forwards `response_format` raw, which Vertex rejects with 400 (verified
 * live 2026-10-22).
 */
function completionTokenFields(apiBase, env = process.env, model = '') {
  const fields = {
    max_completion_tokens: Number(env.XAI_MAX_TOKENS || 65536),
    // Prose such as "I'll read the files" is not a file edit. JSON mode
    // rejects that reply before it can be committed (Decision [2026-10-04-0003]).
    response_format: { type: 'json_object' },
  };
  // api.x.ai accepts these fields. The NewPush gateway is LiteLLM and
  // returns 400 for grok-4.6 unless the request names them
  // (Decision [2026-10-04-0002]).
  if (hostOf(apiBase) !== 'api.x.ai' && /^xai\//.test(String(model))) {
    fields.allowed_openai_params = ['max_completion_tokens', 'response_format'];
  }
  return fields;
}

/** POST JSON over node:http/https with a socket-inactivity timeout. */
function postJson(url, { apiKey, body, timeoutMs, headers = {} }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const payload = Buffer.from(body, 'utf8');
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const req = lib.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || undefined,
      path: `${u.pathname}${u.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': payload.length,
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', fail);
      res.on('end', () => {
        if (settled) return;
        settled = true;
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: res.headers,
          text: async () => text,
          json: async () => JSON.parse(text),
        });
      });
    });
    req.setTimeout(timeoutMs, () => {
      const err = new TypeError('fetch failed');
      err.cause = { code: 'MODEL_INACTIVITY_TIMEOUT' };
      req.destroy(err);
    });
    req.on('error', fail);
    req.write(payload);
    req.end();
  });
}

function transportError(model, err) {
  // `model` is the caller's label and model id, e.g. `Gemini google/...`.
  const code = err && err.cause && err.cause.code ? String(err.cause.code) : (err && err.code) || '';
  const message = `${model} request failed${code ? ` (${code})` : ''}: ${err && err.message}`;
  if (TIMEOUT_CODES.has(code) || (err && err.name === 'AbortError')) {
    // A timeout repeats on retry and multiplies the wall clock. Not retried,
    // but it is still an outage, never a verdict: callers rethrow it.
    return httpError(message, undefined, { code: 'model-timeout', cause: err });
  }
  // Any other transport failure (reset, refused, DNS, unreachable, TLS) is an
  // outage. 503 lets every caller's withRetry treat it as transient.
  return httpError(message, 503, { code: 'model-network', cause: err });
}

const STOP_TYPES = /^(?:budget_exceeded|(?:key|team|user|org|organization)_model_access_denied)$/;
const STOP_MESSAGE = /ExceededBudget|ExceededTokenBudget|budget_exceeded|model_access_denied/i;

/** True when the gateway refused on budget or model access, not on load. */
function isBudgetOrForbidden(status, raw) {
  if (status === 403) return true;
  // Read only the error's own type and message. A body that echoes the
  // request could quote these words from a prompt about budgets.
  let type = '';
  let message = '';
  try {
    const body = JSON.parse(raw);
    const error = body && body.error ? body.error : body;
    type = String((error && (error.type || error.code)) || '');
    message = String((error && error.message) || '');
  } catch {
    return false;
  }
  return STOP_TYPES.test(type) || STOP_MESSAGE.test(message);
}

/**
 * The JSON object or array in a reply, tolerating a code fence or prose around
 * it. Returns null when there is neither.
 */
function parseJsonValue(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const attempt = (s) => {
    try {
      const value = JSON.parse(s);
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  };
  const whole = attempt(raw);
  if (whole) return whole;
  const between = (open, close) => {
    const start = raw.indexOf(open);
    const end = raw.lastIndexOf(close);
    return start >= 0 && end > start ? attempt(raw.slice(start, end + 1)) : null;
  };
  return between('{', '}') || between('[', ']');
}

function parseJsonObject(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const attempt = (s) => {
    try {
      const value = JSON.parse(s);
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  };
  const whole = attempt(raw);
  if (whole) return whole;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  return start >= 0 && end > start ? attempt(raw.slice(start, end + 1)) : null;
}

/**
 * One chat completion that must answer with one JSON object.
 * `normalize`, when given, receives the parsed reply — an object or an array —
 * and returns the object to use, or null to refuse it as unparseable. Without
 * it, only an object is accepted.
 * @returns {Promise<{ json: object, model: string, finishReason: string }>}
 */
async function chatJson({
  apiBase,
  apiKey,
  model,
  messages,
  temperature = 0,
  reasoningEffort,
  fetchImpl,
  timeoutMs,
  label = 'Model',
  env = process.env,
  normalize,
} = {}) {
  const url = `${apiBase}/chat/completions`;
  const body = JSON.stringify({
    model,
    messages,
    temperature,
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    // max_tokens counts thinking and the visible answer together. The
    // completion cap is the visible answer only (Decision [2026-10-04-0001]).
    ...completionTokenFields(apiBase, env, model),
  });
  const waitMs = timeoutMs || chatTimeoutMs(env);
  // LiteLLM falls back to a 600s upstream timeout. Raise it to match ours so
  // a long Gemini Pro gate is not cut at the gateway first.
  const extraHeaders = hostOf(apiBase) === 'api.x.ai'
    ? {}
    : { 'x-litellm-timeout': String(Math.ceil(waitMs / 1000)) };
  let res;
  try {
    res = typeof fetchImpl === 'function'
      ? await fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...extraHeaders },
        body,
      })
      : await postJson(url, { apiKey, body, timeoutMs: waitMs, headers: extraHeaders });
  } catch (err) {
    throw transportError(`${label} ${model}`, err);
  }
  if (!res.ok) {
    let raw = '';
    try {
      raw = typeof res.text === 'function' ? await res.text() : '';
    } catch {
      raw = '';
    }
    const detail = redactModelError(raw, apiKey);
    const suffix = detail ? `: ${detail}` : '';
    if (isBudgetOrForbidden(res.status, raw)) {
      throw httpError(
        `${label} ${model} → ${res.status} budget-or-forbidden${suffix}`,
        403,
        { code: 'budget-or-forbidden', upstreamStatus: res.status },
      );
    }
    // Retry-After rides on the error so the caller's withRetry can honour it
    // (coding-loop/http.js retryAfterMs). Absent header: no field, as before.
    const retryAfter = headerValue(res.headers, 'retry-after');
    throw httpError(
      `${label} ${model} → ${res.status}${suffix}`,
      res.status,
      retryAfter ? { headers: { 'retry-after': retryAfter } } : {},
    );
  }
  let payload;
  try {
    payload = await res.json();
  } catch {
    throw httpError(`${label} ${model} returned a non-JSON response body`, 502);
  }
  const choice = payload && payload.choices && payload.choices[0] ? payload.choices[0] : {};
  const message = choice.message || {};
  const content = typeof message.content === 'string' ? message.content : '';
  const json = typeof normalize === 'function'
    ? normalize(parseJsonValue(content))
    : parseJsonObject(content);
  if (!json) {
    const reasoningLen = typeof message.reasoning_content === 'string' ? message.reasoning_content.length : 0;
    const preview = redactModelError(content, apiKey).slice(0, 120);
    throw httpError(
      `${label} ${model} returned unparseable JSON (finish_reason=${choice.finish_reason || 'unknown'}, content_chars=${content.length}, reasoning_chars=${reasoningLen})${preview ? `: ${preview}` : ''}`,
      502,
      { code: 'unparseable-json', finishReason: choice.finish_reason || 'unknown' },
    );
  }
  return { json, model, finishReason: choice.finish_reason || '' };
}

/**
 * Model ids the key may call (`GET {base}/models`). Used to confirm a pin,
 * never to pick a substitute. A short GET, so global fetch is fine here.
 */
async function listChatModels({ apiBase, apiKey, fetchImpl = fetch }) {
  let res;
  try {
    res = await fetchImpl(`${apiBase}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  } catch (err) {
    throw transportError(`models ${apiBase}`, err);
  }
  if (!res.ok) {
    let raw = '';
    try {
      raw = typeof res.text === 'function' ? await res.text() : '';
    } catch {
      raw = '';
    }
    const detail = redactModelError(raw, apiKey);
    throw httpError(`Model list → ${res.status}${detail ? `: ${detail}` : ''}`, res.status);
  }
  const body = await res.json();
  return (body && Array.isArray(body.data) ? body.data : []).map((item) => item && item.id).filter(Boolean);
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  listChatModels,
  chatJson,
  chatTimeoutMs,
  completionTokenFields,
  isBudgetOrForbidden,
  parseJsonObject,
  parseJsonValue,
  postJson,
  redactModelError,
  transportError,
};
