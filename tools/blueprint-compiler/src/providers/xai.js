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
import { emptyError, loadGatewayConfig, postJson } from "./gateway.js";
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

export async function runXai(ir, prompt) {
  const config = loadGatewayConfig({ timeoutVar: TIMEOUT_VAR });
  const model = gatewayModelId();

  const started = Date.now();
  const data = await postJson(
    `${config.gateway}/v1/chat/completions`,
    {
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(ir) },
        { role: "user", content: prompt },
      ],
    },
    config,
    "xai"
  );

  const choice = data.choices?.[0];
  if (!choice) {
    throw emptyError("xAI returned no choices.");
  }
  if (choice.finish_reason === "content_filter") {
    throw emptyError("xAI filtered the response (finish_reason content_filter).");
  }
  if (choice.message?.refusal) {
    throw emptyError(`xAI refused: ${String(choice.message.refusal).slice(0, 200)}`);
  }
  const text = choice.message?.content ?? "";
  if (typeof text !== "string" || !text.trim()) {
    throw emptyError("xAI returned an empty response.");
  }

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