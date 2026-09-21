/**
 * Sprint 2 provider. Calls Gemini through NewPush's generative AI gateway
 * (Google-native surface: generateContent) with a virtual key resolved from
 * process.env at call time -- never parsed from a .env file (AGENTS.md
 * section Secrets & Configuration). Injected at runtime via `infisical run`
 * or `op run`; this file must never see a real key at rest.
 *
 * The virtual key is a NewPush credential, not a Google one: it is sent as a
 * Bearer token to the gateway and never to generativelanguage.googleapis.com.
 * Provider credentials stay with NewPush.
 *
 * Mirrors mock.js's signature and return shape so compile.js can treat
 * every provider interchangeably.
 *
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 */

// Google-native ids carry no `google/` prefix (that form is for the gateway's
// OpenAI surface only). Pinned rather than a *-latest alias, per the gateway
// guide; the gemini-2.5-* line retires 20 Oct 2026.
const DEFAULT_MODEL = "gemini-3.8-flash";
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

export async function runGemini(ir, prompt) {
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const apiKey = process.env.AI_GW_API_KEY;
  if (!apiKey) {
    throw configError(
      "AI_GW_API_KEY is not set. Inject the NewPush AI gateway virtual key at " +
        "runtime via `infisical run` or `op run` -- see AGENTS.md. Never place " +
        "it in a .env file."
    );
  }

  const gateway = (process.env.AI_GW_BASE_URL || DEFAULT_GATEWAY).replace(/\/+$/, "");
  const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).replace(/^google\//, "");
  const role = (ir.sections.Role ?? "").split("\n")[0];
  const context = [
    `You are compiling and running the NoéMI persona "${ir.title}".`,
    `Role: ${role}`,
    `Skills: ${ir.skills.join(", ") || "(none)"}`,
  ].join("\n");

  const started = Date.now();
  const url = `${gateway}/google/v1beta/models/${model}:generateContent`;

  // A network failure (DNS, TLS, connection reset) makes fetch itself throw
  // a TypeError. fallback.js already treats err.name === "TypeError" as
  // fallback-worthy, so it's left to propagate unmodified rather than
  // caught and rewrapped here.
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${context}\n\n${prompt}` }] }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw httpError(
      `NewPush AI gateway (gemini) returned ${response.status}: ${body.slice(0, 300)}`,
      response.status
    );
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const usage = data.usageMetadata ?? {};

  return {
    provider: "gemini",
    model,
    output: text,
    usage: {
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - started,
      // Sprint 2 doesn't price responses yet -- revisit alongside token/cost
      // reporting when the LLM Arena scoreboard (Sprint 5) needs real numbers.
      costUsd: 0,
    },
  };
}
