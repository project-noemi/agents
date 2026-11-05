
import { parseBlueprint } from "./parse.js";
import { validateBlueprint } from "./validate.js";
import { resolveBlueprint } from "./resolve.js";
import {
  loadLoaderConfig,
  loadModelPolicy,
  loadResolverConfig,
  loadRuntime,
  RUNTIMES,
} from "./config.js";
import { loadFile } from "./loaders/file.js";
import { loadError, loadHttp } from "./loaders/http.js";
import { loadRegistry } from "./loaders/registry.js";
import { runMock } from "./providers/mock.js";
import {
  runGemini,
  gatewayModelId as geminiModelId,
  TIMEOUT_VAR as GEMINI_TIMEOUT_VAR,
} from "./providers/gemini.js";
import {
  runXai,
  gatewayModelId as xaiModelId,
  TIMEOUT_VAR as XAI_TIMEOUT_VAR,
} from "./providers/xai.js";
import { runMastra, loadMastraConfig } from "./runtime/mastra.js";
import { loadGatewayConfig } from "./providers/gateway.js";
import {
  isFallbackError,
  providerOrder,
  runWithFallbacks,
} from "./providers/fallback.js";

// Provider = which model answers.
// Runtime = how the model is called.
const DIRECT = { mock: runMock, gemini: runGemini, xai: runXai };
const LIVE = {
  gemini: { timeoutVar: GEMINI_TIMEOUT_VAR, modelId: geminiModelId },
  xai: { timeoutVar: XAI_TIMEOUT_VAR, modelId: xaiModelId },
};

const isProviderError = (e) =>
  (typeof e?.code === "string" && e.code.startsWith("PROVIDER")) ||
  Number.isInteger(e?.status) ||
  isFallbackError(e);

function toCompileError(err) {
  return {
    code:
      typeof err.code === "string"
        ? err.code
        : Number.isInteger(err.status)
          ? "PROVIDER_HTTP"
          : "PROVIDER_UNAVAILABLE",
    message: err.message,
    ...(Number.isInteger(err.status) ? { status: err.status } : {}),
  };
}

const describeFailure = (e) =>
  Number.isInteger(e.status) ? `HTTP ${e.status}` : e.name;

export const PROVIDERS = Object.keys(DIRECT);

/**
 * Parse, validate and resolve persona Markdown without running a provider.
 */
export async function checkSource(markdown, source, opts = {}) {
  const ir = parseBlueprint(markdown, {
    source,
    modelPolicy: loadModelPolicy(),
  });

  const errors = validateBlueprint(ir);
  if (errors.length) {
    return { ok: false, stage: "validate", errors };
  }

  const repoRoot = opts.repoRoot || loadResolverConfig().repoRoot;
  const { resolved, errors: refErrors } = await resolveBlueprint(ir, {
    repoRoot,
  });

  if (refErrors.length) {
    return { ok: false, stage: "resolve", errors: refErrors };
  }

  return { ok: true, ir, resolved };
}

/**
 * Compile persona Markdown from any source.
 *
 * onStart fires after validation/resolution and before the provider chain.
 * onToken receives each text chunk as it arrives.
 */
export async function compileSource(markdown, source, opts = {}) {
  const checked = await checkSource(markdown, source, opts);
  if (!checked.ok) return checked;

  const { ir, resolved } = checked;
  const preferred = opts.provider ?? ir.modelPolicy.preferred ?? "mock";
  const fallbacks = ir.modelPolicy.fallbacks ?? [];

  const runtime = opts.runtime || loadRuntime();
  if (!RUNTIMES.includes(runtime)) {
    const shown =
      runtime.length > 40 ? `${runtime.slice(0, 37)}...` : runtime;

    return {
      ok: false,
      stage: "provider",
      errors: [
        {
          code: "RUNTIME",
          message: `Unknown runtime "${shown}". Known: ${RUNTIMES.join(", ")}.`,
          path: "runtime",
        },
      ],
    };
  }

  // This flag covers the entire provider chain. Once true, no later provider
  // may run, because its output would be appended to a partial answer.
  let emittedOutput = false;

  const emitToken = (text) => {
    if (typeof text !== "string" || text.length === 0) return;
    emittedOutput = true;
    opts.onToken?.(text);
  };

  const providers = Object.fromEntries(
    Object.entries(DIRECT).map(([name, run]) => [
      name,
      async (input) => {
        try {
          if (runtime === "mastra" && LIVE[name]) {
            return await runMastra(ir, input, {
              provider: name,
              ...LIVE[name],
              ...(typeof opts.onToken === "function" ? { onToken: emitToken } : {}),
            });
          }

          return await run(ir, input, { onToken: emitToken });
        } catch (err) {
          // Also guard against providers that fail to mark their own stream
          // errors. The compiler is the final authority on fallback safety.
          if (
            emittedOutput &&
            err &&
            (typeof err === "object" || typeof err === "function")
          ) {
            err.noFallback = true;
          }
          throw err;
        }
      },
    ])
  );

  // Validate the whole provider chain and its configuration before starting.
  const preflight = (name) => {
    const live = LIVE[name];
    if (!live) return;

    if (runtime === "mastra") {
      loadMastraConfig(live);
    } else {
      loadGatewayConfig({ timeoutVar: live.timeoutVar });
    }
  };

  try {
    for (const name of providerOrder({ preferred, fallbacks, providers })) {
      preflight(name);
    }
  } catch (err) {
    if (!isProviderError(err)) throw err;

    return {
      ok: false,
      stage: "provider",
      errors: [{ ...toCompileError(err), path: "provider" }],
    };
  }

  const fallbacksUsed = [];
  opts.onStart?.({ provider: preferred, runtime });

  try {
    const run = await runWithFallbacks({
      preferred,
      fallbacks,
      providers,
      input: opts.prompt ?? "Hello from the Blueprint Compiler.",
      onFallback: ({ provider, error }) =>
        fallbacksUsed.push({
          provider,
          reason: describeFailure(error),
        }),
    });

    return {
      ok: true,
      ir,
      resolved,
      run: {
        ...run,
        runtime: run.runtime ?? "direct",
        fallbacks: fallbacksUsed,
      },
    };
  } catch (err) {
    if (!isProviderError(err)) throw err;

    return {
      ok: false,
      stage: "provider",
      errors: [toCompileError(err)],
      fallbacks: fallbacksUsed,
    };
  }
}

const LOAD_CODES = new Set(["LOAD", "LOAD_CONFIG"]);

async function loadThenCompile(load, label, opts) {
  let loaded;

  try {
    loaded = await load();
  } catch (err) {
    if (!LOAD_CODES.has(err.code)) throw err;

    return {
      ok: false,
      stage: "load",
      errors: [{ code: err.code, message: err.message, path: label }],
    };
  }

  const next = opts.checkOnly ? checkSource : compileSource;
  return next(loaded.markdown, loaded.source, opts);
}

const loaderConfig = (opts) => ({
  ...loadLoaderConfig(),
  ...opts.loader,
});

const TEXT_REF = "<string>";

export function compileText(markdown, opts = {}) {
  return loadThenCompile(() => {
    const { maxBytes } = loaderConfig(opts);

    if (Buffer.byteLength(markdown, "utf8") > maxBytes) {
      throw loadError(`Persona is larger than the ${maxBytes}-byte limit.`);
    }

    return { markdown, source: { kind: "file", ref: TEXT_REF } };
  }, TEXT_REF, opts);
}

export function compileFile(filePath, opts = {}) {
  return loadThenCompile(() => loadFile(filePath), filePath, opts);
}

export function compileUrl(url, opts = {}) {
  return loadThenCompile(() => loadHttp(url, loaderConfig(opts)), url, opts);
}

export function compileRegistry(ref, opts = {}) {
  return loadThenCompile(
    () => loadRegistry(ref, loaderConfig(opts)),
    ref,
    opts
  );
}
