/**
 * Sprint 5 Arena engine: one blueprint and one prompt, run on every provider
 * at the same time. Yields the ArenaEvent shapes in studio/src/api/types.ts.
 *
 *   arena   first: the compiled blueprint id and the providers that will run
 *   start   a provider began (only after its config preflight passed)
 *   token   streamed text; providers interleave
 *   done    a provider answered
 *   failed  a provider failed. It is RECORDED, never replaced: the Arena
 *           never falls back, because the point is to compare providers
 *   error   the whole run failed before any provider ran (bad blueprint)
 *   end     last: every provider finished and onComplete has run
 *
 * The engine does not know how a blueprint is loaded. `compile(opts)` does:
 * it is called once with { checkOnly: true } (parse, validate, resolve) and
 * then once per provider with { provider, fallbacks: [], prompt, onStart,
 * onToken }. Injecting it keeps the engine testable offline and lets the
 * server decide where the Markdown comes from.
 *
 * Privacy, same rule as audit.js and store/runs.js: a `failed` event carries
 * error codes, an HTTP status and a FIXED message, never gateway text or
 * config values (a gateway can echo a key, a bad AI_GW_BASE_URL can hold
 * credentials). The summary handed to onComplete holds no prompt and no text.
 */
import { randomBytes } from "node:crypto";
import { PROVIDERS } from "./compile.js";

const cap = (v, n = 40) => {
  const s = String(v ?? "");
  return s.length > n ? `${s.slice(0, n - 3)}...` : s;
};
const count = (n) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
const money = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

const SAFE_MESSAGES = {
  PROVIDER_CONFIG: "The provider is not configured on the server.",
  PROVIDER_EMPTY: "The provider returned no usable answer.",
  PROVIDER_UNAVAILABLE: "The provider could not be reached in time.",
  PROVIDER: "The provider is not known to the server.",
  RUNTIME: "The server's runtime setting is not valid.",
};

/**
 * A compile error made safe to send to a browser: code and status are kept,
 * the message is replaced by fixed text.
 * @param {{ code?: string, status?: number }} err
 */
export function safeError(err) {
  const code = typeof err?.code === "string" && err.code ? cap(err.code) : "PROVIDER_FAILED";
  const status = Number.isInteger(err?.status) ? err.status : undefined;
  // hasOwn: "constructor" and "toString" must not find inherited properties.
  const message =
    status !== undefined
      ? `HTTP ${status}`
      : Object.hasOwn(SAFE_MESSAGES, code)
        ? SAFE_MESSAGES[code]
        : "The provider failed.";
  return { code, message, ...(status !== undefined ? { status } : {}) };
}

// An unexpected exception: never its message, only a code if it has one.
const internalError = (err) => ({
  code: typeof err?.code === "string" && err.code ? cap(err.code) : "INTERNAL",
  message: "Internal server error.",
});

/**
 * @param {{
 *   compile: (opts: object) => Promise<object>,
 *   prompt: string,
 *   providers?: string[],
 *   id?: string,
 *   now?: () => number,
 *   onComplete?: (summary: object) => void | Promise<void>,
 * }} args
 */
export async function* runArena({
  compile,
  prompt,
  providers = PROVIDERS,
  id = randomBytes(12).toString("hex"),
  now = Date.now,
  onComplete,
}) {
  const startedAt = now();

  // Check once, so a bad blueprint is one error instead of N identical failures.
  let checked;
  try {
    checked = await compile({ checkOnly: true });
  } catch (err) {
    checked = { ok: false, stage: "internal", errors: [internalError(err)] };
  }
  if (!checked?.ok) {
    yield { type: "error", stage: checked?.stage ?? "internal", errors: checked?.errors ?? [] };
    return;
  }

  const names = [...new Set(providers)];
  yield { type: "arena", id, blueprint: checked.ir.id, providers: names };

  const queue = [];
  let wake = null;
  let open = true;
  let active = names.length;
  const push = (event) => {
    if (!open) return;
    queue.push(event);
    wake?.();
  };

  const results = new Map();

  // Never throws: every failure becomes a `failed` event and a result row.
  async function runProvider(provider) {
    let begun = now();
    let streamed = false;
    const elapsed = () => Math.max(0, Math.round(now() - begun));
    const fail = (stage, errors) => {
      const list = errors.length ? errors : [internalError()];
      push({ type: "failed", provider, stage, errors: list });
      return { provider, ok: false, stage, errorCodes: list.map((e) => e.code), latencyMs: elapsed() };
    };

    try {
      const result = await compile({
        provider,
        // The Arena never falls back: a failed provider is a result.
        fallbacks: [],
        prompt,
        onStart: () => {
          begun = now();
          push({ type: "start", provider });
        },
        onToken: (text) => {
          if (typeof text !== "string" || text.length === 0) return;
          streamed = true;
          push({ type: "token", provider, text });
        },
      });

      if (!result?.ok) {
        return fail(result?.stage ?? "provider", (result?.errors ?? []).map(safeError));
      }

      const { model, output, usage = {} } = result.run ?? {};
      // A provider that returned its whole answer without streaming.
      if (!streamed && typeof output === "string" && output.length > 0) {
        push({ type: "token", provider, text: output });
      }
      const used = {
        inputTokens: count(usage.inputTokens),
        outputTokens: count(usage.outputTokens),
        // Measured here, from the provider's start, so providers compare fairly.
        latencyMs: elapsed(),
        costUsd: money(usage.costUsd),
      };
      push({ type: "done", provider, ...(model ? { model } : {}), usage: used });
      return { provider, ok: true, ...(model ? { model } : {}), ...used };
    } catch (err) {
      return fail("internal", [internalError(err)]);
    }
  }

  // Providers start only now, after the `arena` event was delivered.
  const tasks = names.map(async (provider) => {
    try {
      results.set(provider, await runProvider(provider));
    } finally {
      active -= 1;
      wake?.();
    }
  });

  try {
    // Merge the concurrent providers into one ordered stream.
    for (;;) {
      while (queue.length) yield queue.shift();
      if (active === 0) break;
      await new Promise((resolve) => {
        wake = resolve;
      });
    }
    await Promise.all(tasks);

    const summary = {
      id,
      blueprint: checked.ir.id,
      at: new Date(startedAt).toISOString(),
      durationMs: Math.max(0, Math.round(now() - startedAt)),
      results: names.map((n) => results.get(n)).filter(Boolean),
    };
    try {
      await onComplete?.(summary);
    } catch {
      // Saving is best effort, like run history: the run itself still ends.
    }
    yield { type: "end", id };
  } finally {
    open = false;
  }
}