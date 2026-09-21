/**
 * Sprint 2 provider. Calls the Gemini API with a key resolved from
 * process.env at call time -- never parsed from a .env file (AGENTS.md
 * section Secrets & Configuration). Injected at runtime via `infisical run`
 * or `op run`; this file must never see a real key at rest.
 *
 * Mirrors mock.js's signature and return shape so compile.js can treat
 * every provider interchangeably.
 *
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 */

const DEFAULT_MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
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

export async function runGemini(ir, prompt) {
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw configError(
      "GEMINI_API_KEY is not set. Inject it at runtime via `infisical run` " +
        "or `op run` -- see AGENTS.md. Never place it in a .env file."
    );
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const role = (ir.sections.Role ?? "").split("\n")[0];
  const context = [
    `You are compiling and running the NoéMI persona "${ir.title}".`,
    `Role: ${role}`,
    `Skills: ${ir.skills.join(", ") || "(none)"}`,
  ].join("\n");

  const started = Date.now();
  const url = `${API_BASE}/models/${model}:generateContent`;

  // A network failure (DNS, TLS, connection reset) makes fetch itself throw
  // a TypeError. fallback.js already treats err.name === "TypeError" as
  // fallback-worthy, so it's left to propagate unmodified rather than
  // caught and rewrapped here.
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${context}\n\n${prompt}` }] }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw httpError(
      `Gemini API returned ${response.status}: ${body.slice(0, 300)}`,
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
