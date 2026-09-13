#!/usr/bin/env node
import { compileFile } from "./compile.js";

function usage() {
  console.error("Usage: blueprint-compiler compile <file.md> [--provider mock] [--prompt text]");
  process.exit(2);
}

const args = process.argv.slice(2);
if (args[0] !== "compile" || !args[1]) usage();

const file = args[1];
let provider = "mock";
let prompt = "Hello from the Blueprint Compiler.";
for (let i = 2; i < args.length; i += 1) {
  if (args[i] === "--provider") provider = args[++i];
  else if (args[i] === "--prompt") prompt = args[++i];
}

const result = await compileFile(file, { provider, prompt });
if (!result.ok) {
  console.error(JSON.stringify({ ok: false, errors: result.errors }, null, 2));
  process.exit(1);
}

const audit = {
  task: `compile:${result.ir.id}`,
  inputs: [file, provider],
  actions: ["parse", "validate", "mock-run"],
  risks: [],
  result: "ok",
};
console.error(JSON.stringify(audit));
console.log(JSON.stringify({ ok: true, ir: result.ir, run: result.run }, null, 2));
