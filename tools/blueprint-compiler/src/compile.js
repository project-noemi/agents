import { readFile } from "node:fs/promises";
import { parseBlueprint } from "./parse.js";
import { validateBlueprint } from "./validate.js";
import { runMock } from "./providers/mock.js";

/**
 * @param {string} filePath
 * @param {{ prompt?: string, provider?: string }} [opts]
 */
export async function compileFile(filePath, opts = {}) {
  const markdown = await readFile(filePath, "utf8");
  const ir = parseBlueprint(markdown, { source: { kind: "file", ref: filePath } });
  const errors = validateBlueprint(ir);
  if (errors.length) return { ok: false, errors };

  const provider = opts.provider ?? ir.modelPolicy.preferred ?? "mock";
  if (provider !== "mock") {
    return {
      ok: false,
      errors: [
        {
          code: "PROVIDER",
          message: `Provider "${provider}" is not wired in Sprint 1. Use --provider mock.`,
        },
      ],
    };
  }

  const run = await runMock(ir, opts.prompt ?? "Hello from the Blueprint Compiler.");
  return { ok: true, ir, run };
}
