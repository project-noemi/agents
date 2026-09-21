/**
 * Sprint 2 provider. Calls xAI (Grok) through NewPush's generative AI
 * gateway (OpenAI-compatible surface) with a virtual key resolved from
 * process.env at call time -- never parsed from a .env file (AGENTS.md
 * section Secrets & Configuration). Injected at runtime via `infisical run`
 * or `op run`; this file must never see a real key at rest.
 *
 * The virtual key is a NewPush credential, not an xAI one: it is sent as a
 * Bearer token to the gateway and never to api.x.ai. Provider credentials
 * stay with NewPush. Grok is only served on the gateway's OpenAI surface:
 * POST {gateway}/v1/chat/completions.
 *
 * Mirrors mock.js's and gemini.js's signature and return shape so compile.js
 * can treat every provider interchangeably.
 *
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 */

// On the gateway's OpenAI surface the model is always `provider/id`.
const DEFAULT_MODEL = "xai/grok-4.6";
const DEFAULT_GATEWAY = "https://ai-gw.newpush.com";
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
 * fallback-worthy, everything else (401 bad key, 403 model not allowed or
 * budget exhausted) is not.
 */
function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function runXai(ir, prompt) {
  const timeoutMs = Number(process.env.XAI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const apiKey = process.env.AI_GW_API_KEY;
  if (!apiKey) {
    throw configError(
      "AI_GW_API_KEY is not set. Inject the NewPush AI gateway virtual key at " +
        "runtime via `infisical run` or `op run` -- see AGENTS.md. Never place " +
        "it in a .env file."
    );
  }

  const gateway = (process.env.AI_GW_BASE_URL || DEFAULT_GATEWAY).replace(/\/+$/, "");
  // Accept a bare `grok-4.6` from config, but always send `xai/grok-4.6`:
  // the gateway rejects bare ids on its OpenAI surface.
  const configured = process.env.XAI_MODEL || DEFAULT_MODEL;
  const model = configured.startsWith("xai/") ? configured : `xai/${configured}`;
  const role = (ir.sections.Role ?? "").split("\n")[0];
  const context = [
    `You are compiling and running the NoéMI persona "${ir.title}".`,
    `Role: ${role}`,
    `Skills: ${ir.skills.join(", ") || "(none)"}`,
  ].join("\n");

  const started = Date.now();
  const url = `${gateway}/v1/chat/completions`;

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
      `NewPush AI gateway (xai) returned ${response.status}: ${body.slice(0, 300)}`,
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
