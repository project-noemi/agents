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
      { cwd: pkg, env: { ...process.env, NOEMI_PREFERRED_PROVIDER: "", NOEMI_FALLBACK_PROVIDERS: "", NOEMI_REPO_ROOT: "", ...env } },
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

// stderr is one audit line followed by the pretty-printed { ok: false, errors } block.
function failure(r) {
  const [auditLine, ...rest] = r.stderr.split("\n");
  return { audit: JSON.parse(auditLine), errors: JSON.parse(rest.join("\n")).errors };
}

// Assert on messages only: audit task/inputs legitimately carry the fixture path.
function assertNoRootIn({ audit, errors }, root) {
  for (const msg of [...errors.map((e) => e.message), ...audit.risks]) {
    assert.ok(!msg.includes(root), `leaks a root path: ${msg}`);
  }
}

test("traversal refs: exit 1, every BAD_SLUG reported, no repo root in any message", async () => {
  const r = await run(["compile", fixture("traversal.core.md"), "--provider", "mock"]);
  assert.equal(r.code, 1);
  const f = failure(r);
  assert.deepEqual(f.audit.actions, ["parse", "validate", "resolve"]);
  assert.match(f.audit.result, /^error:BAD_SLUG(,BAD_SLUG){5}$/);
  assert.equal(f.errors.length, 6);
  assert.ok(f.errors.every((e) => e.code === "BAD_SLUG"));
  assertNoRootIn(f, join(pkg, "..", ".."));
});

test("unresolved refs: messages that hit the filesystem still carry no root path", async () => {
  const repoRoot = join(pkg, "..", "..");
  const viaDefault = failure(await run(["compile", fixture("bad-skill.core.md"), "--provider", "mock"]));
  assert.equal(viaDefault.audit.result, "error:UNRESOLVED_SKILL,UNRESOLVED_MCP");
  assertNoRootIn(viaDefault, repoRoot);

  const fixturesRoot = join(pkg, "fixtures");
  const viaEnv = failure(await run(
    ["compile", fixture("bad-skill.core.md"), "--provider", "mock"],
    { NOEMI_REPO_ROOT: fixturesRoot },
  ));
  assert.equal(viaEnv.audit.result, "error:UNRESOLVED_SKILL,UNRESOLVED_MCP");
  assertNoRootIn(viaEnv, fixturesRoot);
});

test("success payload carries resolved refs beside the IR", async () => {
  const r = await run(["compile", fixture("architect.core.md"), "--provider", "mock"]);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.resolved.skills.map((s) => s.path), ["skills/verification/pre-flight-check.md"]);
});
