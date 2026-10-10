#!/usr/bin/env node
import { parseArgs } from "node:util";
import { compileFile } from "./compile.js";

const USAGE = [
  "Usage: blueprint-compiler compile <file.md> [--provider <name>] [--prompt <text>]",
  "  Without --provider, NOEMI_PREFERRED_PROVIDER / NOEMI_FALLBACK_PROVIDERS decide (default: mock).",
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

try { result = await compileFile(file, { provider, prompt }); }
catch (err) {
  console.error(JSON.stringify({ ok: false, errors: [{ code: err.code ?? "INTERNAL", message: err.message }] }, null, 2));
  process.exit(1);
}

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, errors: result.errors }, null, 2));
  process.exit(1);
}

const fellBack = result.run.fallbacks ?? [];

console.error(JSON.stringify({
  task: `compile:${result.ir.id}`,
  inputs: [file, provider ?? "(from config)"],
  actions: ["parse", "validate", ...fellBack.map((f) => `fallback-from:${f.provider}`), `run:${result.run.provider}`],
  risks: fellBack.map((f) => `${f.provider} failed (${f.reason}); fell back`),
  result: "ok",
}));

console.log(JSON.stringify({ ok: true, ir: result.ir, run: result.run }, null, 2));