import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = (n) => join(pkg, "fixtures", n);

const run = (args, env = {}) =>
  new Promise((resolve) =>
    execFile(
      process.execPath,
      [join(pkg, "src", "cli.js"), ...args],
      { cwd: pkg, env: { ...process.env, NOEMI_PREFERRED_PROVIDER: "", NOEMI_FALLBACK_PROVIDERS: "", ...env } },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })
    )
  );

test("success: one audit line on stderr, payload on stdout", async () => {
  const r = await run(["compile", fixture("architect.core.md"), "--provider", "mock"]);
  assert.equal(r.code, 0);
  const lines = r.stderr.trim().split("\n");
  assert.equal(lines.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(lines[0])).sort(), ["actions", "inputs", "result", "risks", "task"]);
  assert.equal(JSON.parse(r.stdout).ok, true);
});

test("failure: exit 1 and an audit record naming MISSING_REFUSAL", async () => {
  const r = await run(["compile", fixture("broken.missing-refusal.md"), "--provider", "mock"]);
  assert.equal(r.code, 1);
  const audit = JSON.parse(r.stderr.split("\n")[0]);
  assert.match(audit.result, /MISSING_REFUSAL/);
});

test("missing file: structured LOAD failure, not a stack trace", async () => {
  const r = await run(["compile", fixture("nope.md")]);
  assert.equal(r.code, 1);
  assert.match(JSON.parse(r.stderr.split("\n")[0]).result, /LOAD/);
});

test("the gateway key never appears in any output", async () => {
  const canary = "sk-secret-canary";
  const r = await run(["compile", fixture("architect.core.md"), "--provider", "mock"], { AI_GW_API_KEY: canary });
  assert.ok(!r.stdout.includes(canary) && !r.stderr.includes(canary));
});