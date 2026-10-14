/**
 * Sprint 2 provider. Calls Gemini through NewPush's generative AI gateway
 * (Google-native surface: generateContent). Key, origin, timeout and retry
 * come from gateway.js; the virtual key never goes to
 * generativelanguage.googleapis.com.
 *
 * Mirrors mock.js's signature and return shape so compile.js can treat
 * every provider interchangeably.
 *
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 */
import { emptyError, loadGatewayConfig, postJson } from "./gateway.js";
import { buildSystemPrompt } from "./prompt.js";

// Google-native ids carry no `google/` prefix (that form is for the gateway's
// OpenAI surface only). Pinned rather than a *-latest alias, per the gateway
// guide; the gemini-2.5-* line retires 20 Oct 2026.
const DEFAULT_MODEL = "gemini-3.8-flash";
export const TIMEOUT_VAR = "GEMINI_TIMEOUT_MS";

/** The Google-native model id (no `google/` prefix). */
const nativeModel = (env = process.env) => (env.GEMINI_MODEL || DEFAULT_MODEL).replace(/^google\//, "");

/**
 * The same model as the gateway's OpenAI surface names it (`provider/model`).
 * The Mastra runtime uses this surface, so one GEMINI_MODEL setting drives both runtimes.
 */
export const gatewayModelId = (env = process.env) => `google/${nativeModel(env)}`;

// STOP and MAX_TOKENS are normal ends; everything else (SAFETY, RECITATION,
// BLOCKLIST, PROHIBITED_CONTENT, SPII, OTHER, ...) means the text can't be trusted.
const OK_FINISH = new Set([undefined, "STOP", "MAX_TOKENS", "FINISH_REASON_UNSPECIFIED"]);

export async function runGemini(ir, prompt) {
  const config = loadGatewayConfig({ timeoutVar: TIMEOUT_VAR });
  const model = nativeModel();

  const started = Date.now();
  const data = await postJson(
    `${config.gateway}/google/v1beta/models/${model}:generateContent`,
    {
      systemInstruction: { parts: [{ text: buildSystemPrompt(ir) }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    },
    config,
    "gemini"
  );

  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) {
    throw emptyError(`Gemini blocked the prompt (${blockReason}).`);
  }
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw emptyError("Gemini returned no candidates.");
  }
  if (!OK_FINISH.has(candidate.finishReason)) {
    throw emptyError(`Gemini stopped with finishReason ${candidate.finishReason}.`);
  }
  const text = candidate.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw emptyError("Gemini returned an empty response.");
  }

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