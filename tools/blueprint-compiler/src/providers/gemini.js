/**
 * Gemini provider through NewPush's Google-native gateway surface.
 * Pass opts.onToken to receive validated text deltas as they arrive.
 */
import { emptyError, loadGatewayConfig, postJson, withGatewayRetry } from "./gateway.js";
import { buildSystemPrompt } from "./prompt.js";
import { readGeminiSse } from "./streaming.js";

const DEFAULT_MODEL = "gemini-3.8-flash";
export const TIMEOUT_VAR = "GEMINI_TIMEOUT_MS";
const nativeModel = (env = process.env) => (env.GEMINI_MODEL || DEFAULT_MODEL).replace(/^google\//, "");
export const gatewayModelId = (env = process.env) => `google/${nativeModel(env)}`;

export async function runGemini(ir, prompt, opts = {}) {
  const config = loadGatewayConfig({ timeoutVar: TIMEOUT_VAR });
  const model = nativeModel();
  const started = Date.now();
  let text = "";
  let usage = {};

  const requestBody = {
    systemInstruction: { parts: [{ text: buildSystemPrompt(ir) }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  if (typeof opts.onToken !== "function") {
    const data = await postJson(
      `${config.gateway}/google/v1beta/models/${model}:generateContent`,
      requestBody, config, "gemini"
    );
    if (data.promptFeedback?.blockReason) throw emptyError("Gemini blocked the prompt.");
    const candidate = data.candidates?.[0];
    if (!candidate || ![undefined, "STOP", "MAX_TOKENS", "FINISH_REASON_UNSPECIFIED"].includes(candidate.finishReason)) {
      throw emptyError("Gemini returned a blocked or unusable response.");
    }
    text = candidate.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    usage = data.usageMetadata ?? {};
  } else {
    const response = await withGatewayRetry(async () => {
      const res = await fetch(
        `${config.gateway}/google/v1beta/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(config.timeoutMs),
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(`NewPush AI gateway (gemini) returned ${res.status}: ${body.slice(0, 300)}`);
        err.status = res.status;
        throw err;
      }
      return res;
    }, config);
    for await (const delta of readGeminiSse(response, (metadata) => { usage = metadata; })) {
      text += delta;
      opts.onToken(delta);
    }
    // Usage metadata is captured from the terminal stream chunk when supplied.
  }

  if (!text.trim()) throw emptyError("Gemini returned an empty response.");
  return {
    provider: "gemini", model, output: text,
    usage: {
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - started,
      costUsd: 0,
    },
  };
}
