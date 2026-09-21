/**
 * Sprint 2 provider. Calls the xAI (Grok) API with a key resolved from
 * process.env at call time -- never parsed from a .env file (AGENTS.md
 * section Secrets & Configuration). Injected at runtime via `infisical run`
 * or `op run`; this file must never see a real key at rest.
 *
 * Mirrors mock.js's and gemini.js's signature and return shape so compile.js
 * can treat every provider interchangeably. xAI's API is OpenAI-compatible:
 * POST {API_BASE}/chat/completions with a Bearer token, the same endpoint
 * coding-loop/writer.js already uses for Stage C.
 *
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 */

const DEFAULT_MODEL = "grok-4.6";
const API_BASE = "https://api.x.ai/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Bad configuration (missing/invalid key). Deliberately carries no `status`
 * and isn't a TypeError, so fallback.js's isFallbackError() treats it as
 * NOT fallback-worthy -- a missing key is a setup problem, not a transient
 * one, and should fail closed rather than silently degrade to another
 * provider.
 */
function configError(message) {
  const err = new Error(message);
  err.code = "PROVIDER_CONFIG";
  return err;
}

/**
 * Provider-side failure with an HTTP status. fallback.js's
 * isFallbackError() reads err.status directly: 429 and 5xx are
 * fallback-worthy, everything else (4xx auth/validation errors) is not.
 */
function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function runXai(ir, prompt) {
  const timeoutMs = Number(process.env.XAI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw configError(
      "XAI_API_KEY is not set. Inject it at runtime via `infisical run` " +
        "or `op run` -- see AGENTS.md. Never place it in a .env file."
    );
  }

  const model = process.env.XAI_MODEL || DEFAULT_MODEL;
  const role = (ir.sections.Role ?? "").split("\n")[0];
  const context = [
    `You are compiling and running the NoéMI persona "${ir.title}".`,
    `Role: ${role}`,
    `Skills: ${ir.skills.join(", ") || "(none)"}`,
  ].join("\n");

  const started = Date.now();
  const url = `${API_BASE}/chat/completions`;

  // A network failure (DNS, TLS, connection reset) makes fetch itself throw
  // a TypeError, and a timeout throws a TimeoutError. Both are left to
  // propagate unmodified: fallback.js already classifies them.
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: context },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw httpError(
      `xAI API returned ${response.status}: ${body.slice(0, 300)}`,
      response.status
    );
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage ?? {};

  return {
    provider: "xai",
    model,
    output: text,
    usage: {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
      // Like gemini.js: not priced yet -- revisit with the LLM Arena
      // scoreboard (Sprint 5), which needs real cost numbers.
      costUsd: 0,
    },
  };
}
