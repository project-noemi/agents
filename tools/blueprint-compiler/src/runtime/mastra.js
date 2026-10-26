
/**
 * Sprint 4 runtime: instantiate a Blueprint IR as a Mastra agent and run it
 * through NewPush's generative AI gateway (OpenAI-compatible surface).
 *
 * Provider selection and cross-provider fallback remain in compile.js.
 * Mastra is loaded lazily so direct-runtime runs do not require it at startup.
 * Refusal Criteria are preserved verbatim in the system prompt.
 *
 * When target.onToken is supplied, use Mastra streaming. Otherwise use
 * generate(), which preserves compatibility with non-streaming gateway calls.
 */
import {
  configError,
  emptyError,
  httpError,
  loadGatewayConfig,
  withGatewayRetry,
} from "../providers/gateway.js";
import { buildSystemPrompt } from "../providers/prompt.js";

const PROVIDER_ID = "newpush";
const BAD_FINISH = new Set([
  "content-filter",
  "content_filter",
  "error",
  "aborted",
]);

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

export async function buildMastraAgent(ir, config, deps = {}) {
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
    // Gateway retry policy is the only retry policy.
    errorProcessorDefaults: false,
    maxRetries: 0,
  });

  // Keep raw errors/request details out of CLI audit output.
  agent.__setLogger?.(noopLogger);

  return agent;
}

const cut = (value) => String(value ?? "").slice(0, 300);

/**
 * Translate Mastra / AI SDK errors into shapes understood by fallback.js.
 */
export function normalizeError(err, signal) {
  if (signal?.aborted) {
    return new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError"
    );
  }

  const chain = [];
  let current = err;

  for (let depth = 0; current && depth < 4; depth += 1) {
    chain.push(current);
    current = current.cause;
  }

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

    return new TypeError("fetch failed", { cause: call });
  }

  if (chain.some((item) => item?.name === "TypeError")) {
    const typeError = chain.find((item) => item?.name === "TypeError");
    return emptyError(
      `Mastra could not read the gateway response (${cut(typeError.message)}).`
    );
  }

  return err ?? new Error("Mastra generation failed.");
}

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
 * Run a Mastra agent.
 *
 * Without target.onToken, use generate() and return the completed response.
 * With target.onToken, stream chunks as they arrive.
 *
 * Once a token has been emitted, an error is marked noFallback to prevent
 * retries or provider fallback from duplicating a partial answer.
 */
export async function runMastra(ir, prompt, target, deps = {}) {
  const config = loadMastraConfig(target);
  const agent = await buildMastraAgent(ir, config, deps);
  const started = Date.now();
  const streaming = typeof target.onToken === "function";

  // This spans attempts so no retry can duplicate externally emitted text.
  let emitted = false;

  const attempt = async () => {
    const signal = AbortSignal.timeout(config.timeoutMs);

    try {
      // Non-streaming callers retain the original JSON completion behavior.
      // This also keeps tests and CLI callers from unnecessarily requesting
      // an SSE response from an OpenAI-compatible gateway.
      if (!streaming) {
        let result;

        try {
          result = await agent.generate(prompt, {
            abortSignal: signal,
            maxRetries: 0,
            modelSettings: { maxRetries: 0 },
            maxProcessorRetries: 0,
          });
        } catch (err) {
          throw normalizeError(err, signal);
        }

        if (signal.aborted) {
          throw normalizeError(null, signal);
        }

        assertUsable(result);
        return result;
      }

      const stream = await agent.stream(prompt, {
        abortSignal: signal,
        maxRetries: 0,
        modelSettings: { maxRetries: 0 },
        maxProcessorRetries: 0,
      });

      let streamedText = "";

      for await (const chunk of stream.textStream) {
        if (typeof chunk !== "string" || chunk.length === 0) continue;

        // Mark before invoking the callback: the caller may have received it
        // even if the callback throws.
        emitted = true;
        streamedText += chunk;
        target.onToken(chunk);
      }

      if (signal.aborted) {
        throw normalizeError(null, signal);
      }

      const [finalText, usage, finishReason] = await Promise.all([
        stream.text,
        stream.usage,
        stream.finishReason,
      ]);

      if (stream.error) {
        const streamError =
          stream.error instanceof Error
            ? stream.error
            : new Error(
                typeof stream.error === "string"
                  ? stream.error
                  : stream.error.message ?? "Mastra stream failed."
              );
        throw streamError;
      }

      const result = {
        text:
          typeof finalText === "string" && finalText.length > 0
            ? finalText
            : streamedText,
        usage: usage ?? {},
        finishReason,
        tripwire: stream.tripwire,
      };

      assertUsable(result);
      return result;
    } catch (err) {
      const normalized = normalizeError(err, signal);

      // Never retry or fall back after partial output has been delivered.
      if (emitted && normalized && typeof normalized === "object") {
        normalized.noFallback = true;
      }

      throw normalized;
    }
  };

  const result = await withGatewayRetry(attempt, config);
  const usage = result.usage ?? {};

  // In streaming mode, the server has already received the tokens. The full
  // output is still returned for the usual compile/runtime result structure.
  return {
    provider: target.provider,
    runtime: "mastra",
    model: config.model,
    output: result.text,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      latencyMs: Date.now() - started,
      costUsd: 0,
    },
  };
}
