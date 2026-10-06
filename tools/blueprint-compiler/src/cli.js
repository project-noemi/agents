#!/usr/bin/env node
import { parseArgs } from "node:util";
import { compileFile } from "./compile.js";
import { auditFromCompile, writeAudit } from "./audit.js";

const USAGE = [
  "Usage: blueprint-compiler compile <file.md> [--provider <name>] [--prompt <text>]",
  "  Without --provider, NOEMI_PREFERRED_PROVIDER / NOEMI_FALLBACK_PROVIDERS decide (default: mock).",
  "  NOEMI_REPO_ROOT overrides the repo root used to resolve skills and MCP refs.",
].join("\n");

function usage(message) { if (message) console.error(message); console.error(USAGE); process.exit(2); }

let parsed;

try {
  parsed = parseArgs({ args: process.argv.slice(2), allowPositionals: true, strict: true,
    options: { provider: { type: "string" }, prompt: { type: "string" } } });
} catch (err) { usage(err.message); }

const [command, file] = parsed.positionals;

if (command !== "compile" || !file) usage();

// No default provider here: leave it undefined so config picks it.
const { provider, prompt = "Hello from the Blueprint Compiler." } = parsed.values;

let result;

try {
  result = await compileFile(file, { provider, prompt });
} catch (err) {
  // Only real bugs reach here; compileFile returns structured errors otherwise.
  result = {
    ok: false,
    stage: "internal",
    errors: [{ code: typeof err.code === "string" ? err.code : "INTERNAL", message: err.message }],
  };
}

// One single-line JSON audit record on stderr, success or failure.
writeAudit(auditFromCompile(result, { file, provider }));

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, errors: result.errors }, null, 2));
  process.exitCode = 1;   // not process.exit(1): lets stderr flush on pipes
} else {
  console.log(JSON.stringify({ ok: true, ir: result.ir, resolved: result.resolved, run: result.run }, null, 2));
}