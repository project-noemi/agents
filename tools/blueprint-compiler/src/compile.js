import { parseBlueprint } from "./parse.js";
import { validateBlueprint } from "./validate.js";
import { resolveBlueprint } from "./resolve.js";
import { loadModelPolicy, loadResolverConfig } from "./config.js";
import { loadFile } from "./loaders/file.js";
import { runMock } from "./providers/mock.js";
import { runGemini } from "./providers/gemini.js";
import { runXai } from "./providers/xai.js";
import { isFallbackError, isRegisteredProvider, runWithFallbacks } from "./providers/fallback.js";

const isProviderError = (e) =>
  (typeof e?.code === "string" && e.code.startsWith("PROVIDER")) ||
  Number.isInteger(e?.status) || isFallbackError(e);

function toCompileError(err) {
  return {
    // DOMException (e.g. TimeoutError) carries a NUMERIC .code (23); only trust string codes.
    code: typeof err.code === "string"
      ? err.code
      : Number.isInteger(err.status) ? "PROVIDER_HTTP" : "PROVIDER_UNAVAILABLE",
    message: err.message,
    ...(Number.isInteger(err.status) ? { status: err.status } : {}),
  };
}

const describeFailure = (e) => (Number.isInteger(e.status) ? `HTTP ${e.status}` : e.name);

/**
 * Compile persona Markdown from any source (file today; http/registry in Sprint 5).
 * Never loads the persona and never logs; callers (CLI, Studio) decide how to log.
 * The only filesystem access is the resolver's read-only existence checks under
 * repoRoot, and only when the persona has **Skill:** or **MCP:** refs.
 * @param {string} markdown
 * @param {import("./ir.js").SourceRef} source
 * @param {{ prompt?: string, provider?: string, repoRoot?: string }} [opts]
 */
export async function compileSource(markdown, source, opts = {}) {
  const ir = parseBlueprint(markdown, { source, modelPolicy: loadModelPolicy() });

  const errors = validateBlueprint(ir);
  if (errors.length) {
    return { ok: false, stage: "validate", errors };
  }

  // `||`, not `??`: an empty repoRoot means "unset", as in config.js.
  const repoRoot = opts.repoRoot || loadResolverConfig().repoRoot;
  const { resolved, errors: refErrors } = await resolveBlueprint(ir, { repoRoot });
  if (refErrors.length) {
    return { ok: false, stage: "resolve", errors: refErrors };
  }

  const preferred = opts.provider ?? ir.modelPolicy.preferred ?? "mock";
  const fallbacks = ir.modelPolicy.fallbacks ?? [];

  const providers = {
    mock: (input) => runMock(ir, input),
    gemini: (input) => runGemini(ir, input),
    xai: (input) => runXai(ir, input),
  };

  if (!isRegisteredProvider(providers, preferred)) {
    return { ok: false, stage: "provider", errors: [{ code: "PROVIDER", path: "provider",
      message: `Unknown provider "${preferred}". Known: ${Object.keys(providers).join(", ")}.` }] };
  }

  const fallbacksUsed = [];

  try {
    const run = await runWithFallbacks({
      preferred, fallbacks, providers,
      input: opts.prompt ?? "Hello from the Blueprint Compiler.",
      onFallback: ({ provider, error }) =>
        fallbacksUsed.push({ provider, reason: describeFailure(error) }),
    });
    return { ok: true, ir, resolved, run: { ...run, fallbacks: fallbacksUsed } };
  } catch (err) {
    if (!isProviderError(err)) throw err;   // real bugs still throw
    return { ok: false, stage: "provider", errors: [toCompileError(err)], fallbacks: fallbacksUsed };
  }
}

/**
 * @param {string} filePath
 * @param {{ prompt?: string, provider?: string, repoRoot?: string }} [opts]
 */
export async function compileFile(filePath, opts = {}) {
  let loaded;
  try {
    loaded = await loadFile(filePath);
  } catch (err) {
    if (err.code !== "LOAD") throw err;
    return { ok: false, stage: "load", errors: [{ code: "LOAD", message: err.message, path: filePath }] };
  }
  return compileSource(loaded.markdown, loaded.source, opts);
}