/**
 * Sprint 3 runtime: instantiate a Blueprint IR as a Mastra agent and run it
 * through NewPush's generative AI gateway (OpenAI-compatible surface).
 *
 * This is a RUNTIME, not a provider. Which model answers is still decided by
 * provider selection (NOEMI_PREFERRED_PROVIDER / NOEMI_FALLBACK_PROVIDERS);
 * `--runtime mastra` only changes HOW that model is called. compile.js passes
 * a `target` describing the chosen provider:
 *
 *   { provider: "xai", timeoutVar: "XAI_TIMEOUT_MS", modelId: (env) => "xai/grok-4.6" }
 *
 * so the model and timeout come from the provider's own settings (XAI_MODEL,
 * GEMINI_MODEL, *_TIMEOUT_MS). There is no separate Mastra model setting.
 *
 * Spike result (spikes/mastra-gateway.mjs, ARCHITECTURE.md "Mastra runtime"):
 * Mastra's model layer CAN target the gateway with AI_GW_API_KEY, with two
 * traps this file encodes:
 *   1. `url` is a base. Mastra appends /chat/completions, so we pass
 *      `${gateway}/v1`.
 *   2. The shorthand `{ id: "xai/grok-4.6" }` splits off `xai` as the provider
 *      and sends a bare `grok-4.6`, which the gateway rejects. The
 *      `{ providerId, modelId }` form sends `modelId` untouched.
 *
 * Mastra reports failure differently from the hand-rolled providers, so
 * `normalizeError` and `assertUsable` translate it into the shapes
 * fallback.js already understands (err.status, TimeoutError, "fetch failed",
 * PROVIDER_EMPTY). Without that, a 503 would not fall back and a blocked or
 * empty answer would be returned as a success.
 *
 * Mastra is imported lazily: a direct-runtime run never loads it, and a clone
 * without `npm install` still gets a clear PROVIDER_CONFIG, not a crash.
 *
 * Refusal Criteria: the agent's instructions come from buildSystemPrompt(),
 * which copies them verbatim (REQUIREMENTS.md section 6). The runtime refuses
 * to build an agent for an IR that has none.
 */
import { configError, emptyError, httpError, loadGatewayConfig, withGatewayRetry } from "../providers/gateway.js";
import { buildSystemPrompt } from "../providers/prompt.js";

// Only used to label the model inside Mastra; the gateway never sees it.
const PROVIDER_ID = "newpush";
// These end reasons mean the text cannot be trusted. Empty text always fails too.
const BAD_FINISH = new Set(["content-filter", "error", "aborted"]);

/**
 * How one live provider is reached through the gateway.
 * @typedef {{ provider: string, timeoutVar: string, modelId: (env?: object) => string }} MastraTarget
 */

/**
 * Validate and resolve everything the Mastra runtime needs from the
 * environment, before any request is made. Throws PROVIDER_CONFIG.
 * compile.js calls this up front for every live provider in the chain when
 * the runtime is `mastra`.
 * @param {MastraTarget} target
 */
export function loadMastraConfig({ modelId, timeoutVar }, env = process.env) {
  const gw = loadGatewayConfig({ timeoutVar }, env);   // key, URL, timeout, retries
  return { ...gw, model: modelId(env), modelUrl: `${gw.gateway}/v1` };
}

async function loadMastra() {
  try {
    const [{ Agent }, { noopLogger }] = await Promise.all([
      import("@mastra/core/agent"),
      import("@mastra/core/logger"),
    ]);
    return { Agent, noopLogger };
  } catch (cause) {
    const err = configError(
      "@mastra/core could not be loaded. Run `npm install` in tools/blueprint-compiler " +
        "(Mastra is a package dependency, never a root one)."
    );
    err.cause = cause;
    throw err;
  }
}

/**
 * IR -> Mastra Agent. Does not call the model.
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {ReturnType<typeof loadMastraConfig>} config
 * @param {{ Agent?: Function, noopLogger?: object }} [deps] tests inject fakes
 */
export async function buildMastraAgent(ir, config, deps = {}) {
  // Defense in depth: validate.js already fails closed, but Studio and Arena
  // will call the runtime directly. Never run a persona without its refusals.
  if (typeof ir?.refusalCriteria !== "string" || !ir.refusalCriteria.trim()) {
    const err = new Error('Refusing to build an agent: the IR has no non-empty "Refusal Criteria".');
    err.code = "MISSING_REFUSAL";
    throw err;
  }
  const { Agent, noopLogger } = deps.Agent ? deps : await loadMastra();

  const agent = new Agent({
    id: String(ir.id).replace(/[^a-zA-Z0-9_-]+/g, "-"),
    name: ir.title,
    description: (ir.sections?.Role ?? "").split("\n")[0],
    instructions: buildSystemPrompt(ir),
    model: {
      providerId: PROVIDER_ID,
      modelId: config.model,
      url: config.modelUrl,
      apiKey: config.apiKey,
    },
  });
  // Mastra's default logger prints raw error objects (request bodies included)
  // to stderr, which would corrupt the CLI's one-JSON-line audit record.
  agent.__setLogger?.(noopLogger);
  return agent;
}

const cut = (value) => String(value ?? "").slice(0, 300);

/** Translate a Mastra / AI SDK failure into the error shapes fallback.js reads. */
export function normalizeError(err, signal) {
  if (signal?.aborted) {
    return new DOMException("The operation was aborted due to timeout", "TimeoutError");
  }
  const call = [err, err?.cause].find((e) => e && (Number.isInteger(e.statusCode) || e.name === "AI_APICallError"));
  if (call) {
    if (Number.isInteger(call.statusCode)) {
      // A 2xx here means the body could not be read: a bad gateway, like gateway.js.
      if (call.statusCode >= 200 && call.statusCode < 300) {
        return httpError("NewPush AI gateway (mastra) returned unparseable JSON.", 502);
      }
      return httpError(`NewPush AI gateway (mastra) returned ${call.statusCode}: ${cut(call.message)}`, call.statusCode);
    }
    // APICallError with no status: the connection itself failed. Same shape
    // undici uses, so retry and fallback treat it as a network failure.
    return new TypeError("fetch failed", { cause: call });
  }
  if (err?.name === "TypeError") {
    // The AI SDK dereferenced a field the gateway left out (for example
    // `choices: []`). Fail closed as an unusable answer, never as a bug-fallback.
    return emptyError(`Mastra could not read the gateway response (${cut(err.message)}).`);
  }
  return err;   // real bugs keep propagating
}

/** Throw PROVIDER_EMPTY unless the result is text we can trust. */
function assertUsable(result) {
  if (result?.tripwire) {
    throw emptyError(`Mastra blocked the response (${cut(result.tripwire.reason)}).`);
  }
  if (BAD_FINISH.has(result?.finishReason)) {
    throw emptyError(`Mastra stopped with finishReason ${result.finishReason}.`);
  }
  if (typeof result?.text !== "string" || !result.text.trim()) {
    throw emptyError("Mastra returned an empty response.");
  }
}

/**
 * Run the IR as a Mastra agent on the model of the chosen provider. Same return
 * shape as runMock / runGemini / runXai, except `provider` is the MODEL provider
 * (not "mastra") and `runtime` is "mastra".
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 * @param {MastraTarget} target
 * @param {{ Agent?: Function, noopLogger?: object }} [deps]
 */
export async function runMastra(ir, prompt, target, deps = {}, opts = {}) {
  const config = loadMastraConfig(target);
  const agent = await buildMastraAgent(ir, config, deps);
  const started = Date.now();
  const streaming = typeof opts.onToken === "function";

  const attempt = async () => {
    const signal = AbortSignal.timeout(config.timeoutMs);
    try {
      if (!streaming) {
        const result = await agent.generate(prompt, { maxRetries: 0, abortSignal: signal });
        if (signal.aborted) throw normalizeError(null, signal);
        return { result, output: result.text ?? "" };
      }

      const result = await agent.stream(prompt, { maxRetries: 0, abortSignal: signal });
      let output = "";
      for await (const part of result.fullStream) {
        if (signal.aborted) throw normalizeError(null, signal);
        if (part.type === "text-delta") {
          const delta = part.text ?? part.textDelta ?? "";
          if (typeof delta === "string" && delta.length) {
            output += delta;
            opts.onToken(delta);
          }
        } else if (part.type === "error") {
          throw normalizeError(part.error ?? part, signal);
        }
      }
      return { result, output };
    } catch (err) {
      throw normalizeError(err, signal);
    }
  };

  // Retry only failures before a stream is returned / before tokens are emitted.
  // The outer fallback utility independently prevents switching providers once
  // opts.onToken has been called.
  const streamed = await withGatewayRetry(attempt, config);
  const result = streamed.result;
  assertUsable({ ...result, text: streamed.output });

  return {
    provider: target.provider,
    runtime: "mastra",
    model: config.model,
    output: streamed.output,
    usage: {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      latencyMs: Date.now() - started,
      costUsd: 0,
    },
  };
}
