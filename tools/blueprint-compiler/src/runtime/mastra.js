
/**
 * Sprint 4 runtime: instantiate a Blueprint IR as a Mastra agent and run it
 * through NewPush's generative AI gateway (OpenAI-compatible surface).
 *
 * This is a RUNTIME, not a provider. Provider selection remains responsible
 * for choosing the preferred provider and configured fallbacks.
 *
 * Mastra is imported lazily: direct-runtime runs never load it, and a clone
 * without installed dependencies receives a clear PROVIDER_CONFIG error.
 *
 * Refusal Criteria are preserved verbatim in the system prompt. The runtime
 * refuses to build an agent for an IR that has no non-empty Refusal Criteria.
 */
import {
  configError,
  emptyError,
  httpError,
  loadGatewayConfig,
  withGatewayRetry,
} from "../providers/gateway.js";
import { buildSystemPrompt } from "../providers/prompt.js";

// Only used to label the model inside Mastra; the gateway never sees it.
const PROVIDER_ID = "newpush";

// These finish reasons mean the text cannot be trusted.
const BAD_FINISH = new Set(["content-filter", "error", "aborted"]);

/**
 * How one live provider is reached through the gateway.
 *
 * @typedef {{
 *   provider: string,
 *   timeoutVar: string,
 *   modelId: (env?: object) => string
 * }} MastraTarget
 */

/**
 * Validate and resolve everything the Mastra runtime needs from the
 * environment before any request is made.
 *
 * @param {MastraTarget} target
 */
export function loadMastraConfig({ modelId, timeoutVar }, env = process.env) {
  const gw = loadGatewayConfig({ timeoutVar }, env);

  return {
    ...gw,
    model: modelId(env),
    // Mastra appends /chat/completions to this base URL.
    modelUrl: `${gw.gateway}/v1`,
  };
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
      "@mastra/core could not be loaded. Run `npm install` in " +
        "tools/blueprint-compiler (Mastra is a package dependency, " +
        "never a root one)."
    );

    err.cause = cause;
    throw err;
  }
}

/**
 * IR -> Mastra Agent. Does not call the model.
 *
 * errorProcessorDefaults: false disables Mastra's built-in error processors,
 * which can retry failed generations independently of the gateway retry policy.
 *
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {ReturnType<typeof loadMastraConfig>} config
 * @param {{ Agent?: Function, noopLogger?: object }} [deps]
 */
export async function buildMastraAgent(ir, config, deps = {}) {
  // Defense in depth: validation should already fail closed, but Studio and
  // Arena may call the runtime directly. Never run a persona without refusals.
  if (
    typeof ir?.refusalCriteria !== "string" ||
    !ir.refusalCriteria.trim()
  ) {
    const err = new Error(
      'Refusing to build an agent: the IR has no non-empty "Refusal Criteria".'
    );
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

    // Retry policy belongs to withGatewayRetry(), not Mastra processors.
    errorProcessorDefaults: false,
    maxRetries: 0,
  });

  // Mastra's default logger can print raw errors and request details to
  // stderr, corrupting the CLI's one-JSON-line audit record.
  agent.__setLogger?.(noopLogger);

  return agent;
}

const cut = (value) => String(value ?? "").slice(0, 300);

/**
 * Translate Mastra / AI SDK failures into error shapes understood by
 * fallback.js. Preserve auth/config failures and unexpected programming bugs.
 */
export function normalizeError(err, signal) {
  if (signal?.aborted) {
    return new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError"
    );
  }

  // Mastra may wrap an AI SDK error. Inspect a short cause chain rather than
  // relying on one particular wrapping depth.
  const chain = [];
  let current = err;

  for (let depth = 0; current && depth < 4; depth += 1) {
    chain.push(current);
    current = current.cause;
  }

  // A malformed or unusable successful response must fail closed. In
  // particular, Mastra can throw AI_InvalidResponseDataError before it
  // returns a result when the gateway responds with choices: [].
  const invalidResponse = chain.find(
    (item) =>
      item?.name === "AI_InvalidResponseDataError" ||
      item?.name === "InvalidResponseDataError"
  );

  if (invalidResponse) {
    return emptyError(
      `Mastra could not use the gateway response (${cut(invalidResponse.message)}).`
    );
  }

  const call = chain.find(
    (item) =>
      item &&
      (Number.isInteger(item.statusCode) ||
        item.name === "AI_APICallError")
  );

  if (call) {
    if (Number.isInteger(call.statusCode)) {
      // A 2xx here means the body could not be read: treat it as a bad gateway.
      if (call.statusCode >= 200 && call.statusCode < 300) {
        return httpError(
          "NewPush AI gateway (mastra) returned unparseable JSON.",
          502
        );
      }

      return httpError(
        `NewPush AI gateway (mastra) returned ${call.statusCode}: ${cut(call.message)}`,
        call.statusCode
      );
    }

    // An APICallError without an HTTP status means the connection itself
    // failed. Match the network error shape used by gateway.js.
    return new TypeError("fetch failed", { cause: call });
  }

  if (chain.some((item) => item?.name === "TypeError")) {
    // The AI SDK may dereference a missing response field. Treat malformed
    // provider output as unusable, not as a programming-bug fallback.
    const typeError = chain.find((item) => item?.name === "TypeError");

    return emptyError(
      `Mastra could not read the gateway response (${cut(typeError.message)}).`
    );
  }

  return err; // Unexpected bugs keep propagating.
}

/** Throw PROVIDER_EMPTY unless the result is text we can trust. */
function assertUsable(result) {
  if (result?.tripwire) {
    throw emptyError(
      `Mastra blocked the response (${cut(result.tripwire.reason)}).`
    );
  }

  if (BAD_FINISH.has(result?.finishReason)) {
    throw emptyError(
      `Mastra stopped with finishReason ${result.finishReason}.`
    );
  }

  if (typeof result?.text !== "string" || !result.text.trim()) {
    throw emptyError("Mastra returned an empty response.");
  }
}

/**
 * Run the IR as a Mastra agent on the chosen provider's model.
 *
 * The output shape matches runMock / runGemini / runXai, except provider
 * identifies the actual model provider and runtime is "mastra".
 *
 * This uses generate(), then emits the completed text through the existing
 * caller interface. It does not emit partial tokens while generation is
 * underway, so a failed attempt cannot leak partial output before fallback.
 *
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 * @param {MastraTarget} target
 * @param {{ Agent?: Function, noopLogger?: object }} [deps]
 */
export async function runMastra(ir, prompt, target, deps = {}) {
  const config = loadMastraConfig(target);
  const agent = await buildMastraAgent(ir, config, deps);

  const started = Date.now();

  const attempt = async () => {
    // A fresh timeout signal is required for each retry attempt.
    const signal = AbortSignal.timeout(config.timeoutMs);

    let result;

    try {
      result = await agent.generate(prompt, {
        abortSignal: signal,
        maxRetries: 0,
        // AI SDK model-call retries are disabled so the gateway retry policy
        // is the sole owner of HTTP/network retries.
        modelSettings: {
          maxRetries: 0,
        },

        // Do not let processors trigger additional generations on failure.
        maxProcessorRetries: 0,
      });
    } catch (err) {
      throw normalizeError(err, signal);
    }

    // Mastra may resolve with finishReason "aborted" instead of rejecting.
    if (signal.aborted) {
      throw normalizeError(null, signal);
    }

    return result;
  };

  // Only this layer retries 429, 5xx and eligible network failures.
  const result = await withGatewayRetry(attempt, config);

  assertUsable(result);

  const usage = result.usage ?? {};

  return {
    provider: target.provider,
    runtime: "mastra",
    model: config.model,
    output: result.text,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      latencyMs: Date.now() - started,
      // Not priced yet, like gemini.js / xai.js.
      costUsd: 0,
    },
  };
}
