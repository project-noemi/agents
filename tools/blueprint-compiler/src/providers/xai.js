/**
 * Sprint 2 provider. Calls xAI (Grok) through NewPush's generative AI
 * gateway. Grok is only served on the gateway's OpenAI surface:
 * POST {gateway}/v1/chat/completions. Key, origin, timeout and retry come
 * from gateway.js; the virtual key never goes to api.x.ai.
 *
 * Mirrors mock.js's and gemini.js's signature and return shape so compile.js
 * can treat every provider interchangeably.
 *
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 */
import { emptyError, loadGatewayConfig, postSse } from "./gateway.js";
import { buildSystemPrompt } from "./prompt.js";

// On the gateway's OpenAI surface the model is always `provider/id`.
const DEFAULT_MODEL = "xai/grok-4.6";
export const TIMEOUT_VAR = "XAI_TIMEOUT_MS";

/**
 * Accept a bare `grok-4.6` from config, but always use `xai/grok-4.6`: the
 * gateway rejects bare ids on its OpenAI surface. The Mastra runtime uses the
 * same id, so one XAI_MODEL setting drives both runtimes.
 */
export const gatewayModelId = (env = process.env) => {
  const configured = env.XAI_MODEL || DEFAULT_MODEL;
  return configured.startsWith("xai/") ? configured : `xai/${configured}`;
};

export async function runXai(ir, prompt, { onToken } = {}) {
  const config = loadGatewayConfig({ timeoutVar: TIMEOUT_VAR });
  const model = gatewayModelId();
  const started = Date.now();

  let output = "";
  let usage = {};

  await postSse(
    `${config.gateway}/v1/chat/completions`,
    {
      model,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: buildSystemPrompt(ir) },
        { role: "user", content: prompt },
      ],
    },
    config,
    "xai",
    (event, markEmitted) => {
      if (event.error) {
        const error = new Error("xAI returned a stream error.");
        error.noFallback = output.length > 0;
        throw error;
      }

      if (event.usage) usage = event.usage;

      const choice = event.choices?.[0];
      if (choice?.finish_reason === "content_filter") {
        const error = emptyError("xAI filtered the response (finish_reason content_filter).");
        error.noFallback = output.length > 0;
        throw error;
      }

      const refusal = choice?.delta?.refusal;
      if (refusal) {
        const error = emptyError(`xAI refused: ${String(refusal).slice(0, 200)}`);
        error.noFallback = output.length > 0;
        throw error;
      }

      const text = choice?.delta?.content;
      if (typeof text === "string" && text.length > 0) {
        markEmitted();
        output += text;
        onToken?.(text);
      }
    }
  );

  if (!output.trim()) {
    throw emptyError("xAI returned an empty response.");
  }

  return {
    provider: "xai",
    model,
    output,
    usage: {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
      costUsd: 0,
    },
  };
}
