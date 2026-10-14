import { parseBlueprint } from "./parse.js";
import { validateBlueprint } from "./validate.js";
import { resolveBlueprint } from "./resolve.js";
import { loadLoaderConfig, loadModelPolicy, loadResolverConfig } from "./config.js";
import { loadFile } from "./loaders/file.js";
import { loadHttp } from "./loaders/http.js";
import { loadRegistry } from "./loaders/registry.js";
import { runMock } from "./providers/mock.js";
import { runGemini, TIMEOUT_VAR as GEMINI_TIMEOUT_VAR } from "./providers/gemini.js";
import { runXai, TIMEOUT_VAR as XAI_TIMEOUT_VAR } from "./providers/xai.js";
import { runMastra, loadMastraConfig } from "./runtime/mastra.js";
import { loadGatewayConfig } from "./providers/gateway.js";
import { isFallbackError, providerOrder, runWithFallbacks } from "./providers/fallback.js";

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
 * Compile persona Markdown from any source (file, http, or registry).
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
    mastra: (input) => runMastra(ir, input),
  };

  // Check the whole chain before any provider runs: unknown names and bad
  // gateway config (key, URL, timeout) fail closed up front, not mid-fallback.
  const preflight = {
    gemini: () => loadGatewayConfig({ timeoutVar: GEMINI_TIMEOUT_VAR }),
    xai: () => loadGatewayConfig({ timeoutVar: XAI_TIMEOUT_VAR }),
    mastra: () => loadMastraConfig(),   // gateway config + MASTRA_MODEL
  };
  try {
    for (const name of providerOrder({ preferred, fallbacks, providers })) {
      preflight[name]?.();
    }
  } catch (err) {
    if (!isProviderError(err)) throw err;
    return { ok: false, stage: "provider", errors: [{ ...toCompileError(err), path: "provider" }] };
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

const LOAD_CODES = new Set(["LOAD", "LOAD_CONFIG"]);

// Every loader ends here, so a persona from a file, a URL, or the registry takes
// the identical compileSource path (validate, resolve, run) and fails the same way.
async function loadThenCompile(load, label, opts) {
  let loaded;
  try {
    loaded = await load();
  } catch (err) {
    if (!LOAD_CODES.has(err.code)) throw err;   // real bugs still throw
    return { ok: false, stage: "load", errors: [{ code: err.code, message: err.message, path: label }] };
  }
  return compileSource(loaded.markdown, loaded.source, opts);
}

// opts.loader overrides the env-derived loader settings (tests, Studio).
const loaderConfig = (opts) => ({ ...loadLoaderConfig(), ...opts.loader });

/**
 * @param {string} filePath
 * @param {{ prompt?: string, provider?: string, repoRoot?: string }} [opts]
 */
export function compileFile(filePath, opts = {}) {
  return loadThenCompile(() => loadFile(filePath), filePath, opts);
}

/**
 * Compile a persona served over http(s). See loaders/http.js for the limits.
 * @param {string} url
 * @param {{ prompt?: string, provider?: string, repoRoot?: string,
 *   loader?: { allowedHosts?: string[], timeoutMs?: number, maxBytes?: number } }} [opts]
 */
export function compileUrl(url, opts = {}) {
  return loadThenCompile(() => loadHttp(url, loaderConfig(opts)), url, opts);
}

/**
 * Compile a persona from the versioned registry: `domain/name[@version]`.
 * @param {string} ref
 * @param {Parameters<typeof compileUrl>[1]} [opts] opts.loader may also set `registry: { baseUrl, defaultVersion }`
 */
export function compileRegistry(ref, opts = {}) {
  return loadThenCompile(() => loadRegistry(ref, loaderConfig(opts)), ref, opts);
}
