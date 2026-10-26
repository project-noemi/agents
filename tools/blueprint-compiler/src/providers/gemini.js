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
import { emptyError, loadGatewayConfig, postSse } from "./gateway.js";
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


export async function runGemini(ir, prompt, { onToken } = {}) {
  const config = loadGatewayConfig({ timeoutVar: TIMEOUT_VAR });
  const model = nativeModel();
  const started = Date.now();

  let output = "";
  let usage = {};
  let finishReason;

  await postSse(
    `${config.gateway}/google/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      systemInstruction: { parts: [{ text: buildSystemPrompt(ir) }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    },
    config,
    "gemini",
    (event, markEmitted) => {
      const blockReason = event.promptFeedback?.blockReason;
      if (blockReason) {
        const error = emptyError(`Gemini blocked the prompt (${blockReason}).`);
        error.noFallback = output.length > 0;
        throw error;
      }

      const candidate = event.candidates?.[0];
      if (candidate?.finishReason) finishReason = candidate.finishReason;

      if (finishReason && !OK_FINISH.has(finishReason)) {
        const error = emptyError(`Gemini stopped with finishReason ${finishReason}.`);
        error.noFallback = output.length > 0;
        throw error;
      }

      const text =
        candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

      if (text) {
        markEmitted();
        output += text;
        onToken?.(text);
      }

      if (event.usageMetadata) usage = event.usageMetadata;
    }
  );

  if (!output.trim()) {
    throw emptyError("Gemini returned an empty response.");
  }

  return {
    provider: "gemini",
    model,
    output,
    usage: {
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - started,
      costUsd: 0,
    },
  };
}