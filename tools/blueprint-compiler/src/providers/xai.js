/**
 * xAI (Grok) provider over NewPush's OpenAI-compatible gateway.
 * Streaming is opt-in through onToken so the same adapter works for callers
 * that still want a single completed result.
 */
import { emptyError, loadGatewayConfig, postJson } from "./gateway.js";
import { buildSystemPrompt } from "./prompt.js";
import { readSse } from "./streaming.js";

const DEFAULT_MODEL = "xai/grok-4.6";
export const TIMEOUT_VAR = "XAI_TIMEOUT_MS";

export const gatewayModelId = (env = process.env) => {
  const configured = env.XAI_MODEL || DEFAULT_MODEL;
  return configured.startsWith("xai/") ? configured : `xai/${configured}`;
};

export async function runXai(ir, prompt, opts = {}) {
  const config = loadGatewayConfig({ timeoutVar: TIMEOUT_VAR });
  const model = gatewayModelId();
  const started = Date.now();
  let text = "";
  let usage = {};

  if (typeof opts.onToken !== "function") {
    const data = await postJson(
      `${config.gateway}/v1/chat/completions`,
      { model, messages: [
        { role: "system", content: buildSystemPrompt(ir) },
        { role: "user", content: prompt },
      ] },
      config,
      "xai"
    );
    const choice = data.choices?.[0];
    if (!choice || choice.finish_reason === "content_filter" || choice.message?.refusal) {
      throw emptyError("xAI returned a blocked or unusable response.");
    }
    text = choice.message?.content ?? "";
    usage = data.usage ?? {};
  } else {
    const attempt = async () => {
      const response = await fetch(`${config.gateway}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model,
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            { role: "system", content: buildSystemPrompt(ir) },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const err = new Error(`NewPush AI gateway (xai) returned ${response.status}: ${body.slice(0, 300)}`);
        err.status = response.status;
        throw err;
      }
      return response;
    };
    // Reuse the same retry policy as the non-streaming provider. It applies
    // before a response stream is returned; post-header errors cannot retry.
    const { withGatewayRetry } = await import("./gateway.js");
    const response = await withGatewayRetry(attempt, config);
    for await (const data of readSse(response)) {
      if (data.usage) usage = data.usage;
      const choice = data.choices?.[0];
      if (choice?.finish_reason === "content_filter" || choice?.delta?.refusal) {
        throw emptyError("xAI filtered or refused the response.");
      }
      const delta = choice?.delta?.content;
      if (typeof delta === "string" && delta.length) {
        text += delta;
        opts.onToken(delta);
      }
    }
  }

  if (typeof text !== "string" || !text.trim()) throw emptyError("xAI returned an empty response.");
  return {
    provider: "xai", model, output: text,
    usage: {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
      costUsd: 0,
    },
  };
}
