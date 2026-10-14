/**
 * Sprint 3 runtime: instantiate a Blueprint IR as a Mastra agent and run it
 * through NewPush's generative AI gateway (OpenAI-compatible surface).
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
 * Mastra is imported lazily: a mock-only run never loads it, and a clone
 * without `npm install` still gets a clear PROVIDER_CONFIG, not a crash.
 *
 * Refusal Criteria: the agent's instructions come from buildSystemPrompt(),
 * which copies them verbatim (REQUIREMENTS.md section 6). The runtime refuses
 * to build an agent for an IR that has none.
 */
import { configError, emptyError, httpError, loadGatewayConfig, withGatewayRetry } from "../providers/gateway.js";
import { buildSystemPrompt } from "../providers/prompt.js";

export const TIMEOUT_VAR = "MASTRA_TIMEOUT_MS";
export const MODEL_VAR = "MASTRA_MODEL";
// Gateway OpenAI surface ids are always `provider/model`.
export const DEFAULT_MODEL = "xai/grok-4.6";
// Only used to label the model inside Mastra; the gateway never sees it.
const PROVIDER_ID = "newpush";
// These end reasons mean the text cannot be trusted. Empty text always fails too.
const BAD_FINISH = new Set(["content-filter", "error", "aborted"]);

/**
 * Validate and resolve everything the Mastra provider needs from the
 * environment, before any request is made. Throws PROVIDER_CONFIG.
 * compile.js calls this up front for every `mastra` in the provider chain.
 */
export function loadMastraConfig(env = process.env) {
  const gw = loadGatewayConfig({ timeoutVar: TIMEOUT_VAR }, env);
  const model = env[MODEL_VAR]?.trim() || DEFAULT_MODEL;
  if (!/^[^/\s]+\/[^\s]+$/.test(model)) {
    throw configError(`${MODEL_VAR} must look like "provider/model" (for example xai/grok-4.6); got "${model}".`);
  }
  return { ...gw, model, modelUrl: `${gw.gateway}/v1` };
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
 * Provider-shaped entry point: same signature and return shape as runMock /
 * runGemini / runXai, so compile.js treats it as one more provider.
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 * @param {{ Agent?: Function, noopLogger?: object }} [deps]
 */
export async function runMastra(ir, prompt, deps = {}) {
  const config = loadMastraConfig();
  const agent = await buildMastraAgent(ir, config, deps);

  const started = Date.now();
  const attempt = async () => {
    // Fresh signal per attempt, as in gateway.js. Mastra resolves (rather than
    // rejects) with finishReason "aborted" on timeout, so check the signal too.
    const signal = AbortSignal.timeout(config.timeoutMs);
    let result;
    try {
      // maxRetries 0: retrying is withGatewayRetry's job, so there is one policy.
      result = await agent.generate(prompt, { maxRetries: 0, abortSignal: signal });
    } catch (err) {
      throw normalizeError(err, signal);
    }
    if (signal.aborted) throw normalizeError(null, signal);
    return result;
  };

  const result = await withGatewayRetry(attempt, config);
  assertUsable(result);

  return {
    provider: "mastra",
    model: config.model,
    output: result.text,
    usage: {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      latencyMs: Date.now() - started,
      // Not priced yet, like gemini.js / xai.js: revisit with the Arena scoreboard.
      costUsd: 0,
    },
  };
}
