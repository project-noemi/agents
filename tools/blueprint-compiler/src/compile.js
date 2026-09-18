import { readFile } from "node:fs/promises";
import { parseBlueprint } from "./parse.js";
import { validateBlueprint } from "./validate.js";
import { runMock } from "./providers/mock.js";
import { runWithFallbacks } from "./providers/fallback.js";

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
  };

  const run = await runWithFallbacks({
    preferred,
    fallbacks,
    providers,
    input: opts.prompt ?? "Hello from the Blueprint Compiler.",
  });

  return { ok: true, ir, run };
}
