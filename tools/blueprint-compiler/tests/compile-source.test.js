import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileFile, compileSource } from "../src/compile.js";
import { persona } from "./helpers/persona.js";
import { withEnv } from "./helpers/fake-network.js";

const here = dirname(fileURLToPath(import.meta.url));
const clean = { NOEMI_PREFERRED_PROVIDER: undefined, NOEMI_FALLBACK_PROVIDERS: undefined, NOEMI_REPO_ROOT: undefined };
const fixtures = join(here, "..", "fixtures");
const withRefs = persona({ workflow: "**Skill:** `verification/pre-flight-check`\n**MCP:** `github`" });
const src = { kind: "file", ref: "in-memory.md" };

test("compileSource runs from a string with no filesystem", async () => {
  await withEnv(clean, async () => {
    const r = await compileSource(persona(), src, { provider: "mock" });
    assert.equal(r.ok, true);
    assert.equal(r.run.provider, "mock");
    assert.match(r.ir.refusalCriteria, /Refused Task Types/);
  });
});

test("compileSource reports stage validate for an invalid persona", async () => {
  // Uses a missing heading, which fails in every commit. After commit 3 you can
  // also test a missing refusal section the same way.
  const r = await compileSource(persona().replace("## Mission\nTest.\n", ""), src);
  assert.equal(r.ok, false);
  assert.equal(r.stage, "validate");
  assert.ok(r.errors.some((e) => e.code === "MISSING_HEADING" && e.path === "Mission"));
});

test("config flows through compileSource", async () => {
  await withEnv({ NOEMI_PREFERRED_PROVIDER: "nope", NOEMI_FALLBACK_PROVIDERS: undefined }, async () => {
    const r = await compileSource(persona(), src);
    assert.equal(r.errors[0].code, "PROVIDER");
    assert.match(r.errors[0].message, /nope/);
  });
});

test("compileFile returns a structured LOAD error for a missing file", async () => {
  const r = await compileFile(join(here, "does-not-exist.md"));
  assert.equal(r.ok, false);
  assert.equal(r.stage, "load");
  assert.equal(r.errors[0].code, "LOAD");
});

test("an unresolvable ref fails closed at stage resolve before any provider runs", async () => {
  await withEnv(clean, async () => {
    const md = persona({ workflow: "**Skill:** `verification/does-not-exist`\n**MCP:** `nope`" });
    // xai with no key would throw PROVIDER_CONFIG if it ran; resolve must stop first.
    const r = await compileSource(md, src, { provider: "xai", repoRoot: fixtures });
    assert.equal(r.ok, false);
    assert.equal(r.stage, "resolve");
    assert.deepEqual(r.errors.map((e) => e.code), ["UNRESOLVED_SKILL", "UNRESOLVED_MCP"]);
  });
});

test("resolved refs come back beside the IR, which keeps its raw refs", async () => {
  await withEnv(clean, async () => {
    const r = await compileSource(withRefs, src, { provider: "mock", repoRoot: fixtures });
    assert.equal(r.ok, true);
    assert.deepEqual(r.resolved.skills.map((s) => s.path), ["skills/verification/pre-flight-check.md"]);
    assert.deepEqual(r.resolved.mcp.map((m) => m.path), ["mcp-protocols/github.md"]);
    assert.deepEqual(r.ir.skills, ["verification/pre-flight-check"]);
    assert.equal(r.ir.resolved, undefined);
  });
});

test("opts.repoRoot beats NOEMI_REPO_ROOT", async () => {
  await withEnv({ ...clean, NOEMI_REPO_ROOT: join(fixtures, "no-such-root") }, async () => {
    const viaEnv = await compileSource(withRefs, src, { provider: "mock" });
    assert.equal(viaEnv.errors[0].code, "RESOLVE_ROOT");
    const viaOpts = await compileSource(withRefs, src, { provider: "mock", repoRoot: fixtures });
    assert.equal(viaOpts.ok, true);
  });
});

test("an empty opts.repoRoot means unset and falls back to config", async () => {
  await withEnv({ ...clean, NOEMI_REPO_ROOT: fixtures }, async () => {
    const r = await compileSource(withRefs, src, { provider: "mock", repoRoot: "" });
    assert.equal(r.ok, true);
    assert.deepEqual(r.resolved.mcp.map((m) => m.path), ["mcp-protocols/github.md"]);
  });
});
