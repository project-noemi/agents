import { readFile } from "node:fs/promises";
import { parseBlueprint } from "./parse.js";
import { validateBlueprint } from "./validate.js";
import { runMock } from "./providers/mock.js";
import { runGemini } from "./providers/gemini.js";
import { isFallbackError, runWithFallbacks } from "./providers/fallback.js";

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
 * @param {string} filePath
 * @param {{ prompt?: string, provider?: string }} [opts]
 */
export async function compileFile(filePath, opts = {}) {
  const markdown = await readFile(filePath, "utf8");

  const ir = parseBlueprint(markdown, {
    source: { kind: "file", ref: filePath },
  });

  const errors = validateBlueprint(ir);
  if (errors.length) {
    return { ok: false, errors };
  }

  // Read the preferred model and fallback order from the IR.
  const preferred = opts.provider ?? ir.modelPolicy.preferred ?? "mock";
  const fallbacks = ir.modelPolicy.fallbacks ?? [];

  const providers = {
    mock: (input) => runMock(ir, input),
    gemini: (input) => runGemini(ir, input),
  };

  if (typeof providers[preferred] !== "function") {
    return { ok: false, errors: [{ code: "PROVIDER", path: "provider",
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
    return { ok: true, ir, run: { ...run, fallbacks: fallbacksUsed } };
  } catch (err) {
    if (!isProviderError(err)) throw err;   // real bugs still throw
    return { ok: false, errors: [toCompileError(err)] };
  }

  const run = await runWithFallbacks({
    preferred,
    fallbacks,
    providers,
    input: opts.prompt ?? "Hello from the Blueprint Compiler.",
  });

  return { ok: true, ir, run };
}
