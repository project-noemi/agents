import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileFile } from "../src/compile.js";
import { parseBlueprint } from "../src/parse.js";
import { validateBlueprint } from "../src/validate.js";
import { withEnv } from "./helpers/fake-network.js";

const root = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(root, "..", "fixtures", name);
// Pinned so these tests never depend on NOEMI_REPO_ROOT or on the real skills/ tree.
const repoRoot = join(root, "..", "fixtures");

test("parses a valid persona and extracts skill refs", async () => {
  const result = await compileFile(fixture("architect.core.md"), {
    repoRoot,
    provider: "mock",
    prompt: "review src/parse.js",
  });
  assert.equal(result.ok, true);
  assert.equal(result.ir.id, "coding/architect");
  assert.equal(result.ir.title, "Architect — Coding Agent");
  assert.deepEqual(result.ir.skills, ["verification/pre-flight-check"]);
  assert.match(result.run.output, /compiled coding\/architect/);
  assert.equal(result.run.provider, "mock");
});

test("rejects a persona that omits Refusal Criteria", async () => {
  const result = await compileFile(fixture("broken.missing-refusal.md"));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === "MISSING_REFUSAL"));
});

test("validate flags missing Role", () => {
  const ir = parseBlueprint("# X — Y Agent\n\n## Tone\nok\n", {
    source: { kind: "file", ref: "x.md" },
  });
  const errors = validateBlueprint(ir);
  assert.ok(errors.some((e) => e.path === "Role"));
});

test("derives id from agents/{domain}/{name} paths, not the clone folder name", () => {
  const md = [
    "# Architect — Coding Agent",
    "",
    "## Role",
    "Keep structure sound.",
  ].join("\n");

  const fromPersonaPath = parseBlueprint(md, {
    source: { kind: "file", ref: "/repo/agents/coding/architect/core.md" },
  });
  assert.equal(fromPersonaPath.id, "coding/architect");

  const fromFlatPersona = parseBlueprint(md, {
    source: { kind: "file", ref: "/repo/agents/communication/postman.md" },
  });
  assert.equal(fromFlatPersona.id, "communication/postman");

  const fromFixtureInThisClone = parseBlueprint(md, {
    source: {
      kind: "file",
      ref: "/Users/dev/project-noemi/agents/tools/blueprint-compiler/fixtures/architect.core.md",
    },
  });
  assert.equal(fromFixtureInThisClone.id, "coding/architect");
});

test("refuses an unknown preferred provider", async () => {
  const result = await compileFile(fixture("architect.core.md"), {
    repoRoot,
    provider: "anthropic",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "PROVIDER");
});


test("inherited object methods are not providers", async () => {
  for (const provider of ["toString", "constructor"]) {
    const result = await compileFile(fixture("architect.core.md"), { repoRoot, provider });
    assert.equal(result.ok, false, provider);
    assert.equal(result.errors[0].code, "PROVIDER");
    assert.equal(result.run, undefined);
    assert.match(result.errors[0].message, new RegExp(provider));
  }
});

test("a misspelled preferred provider fails closed even when a fallback is configured", async () => {
  await withEnv({ NOEMI_FALLBACK_PROVIDERS: "mock" }, async () => {
    const result = await compileFile(fixture("architect.core.md"), { repoRoot, provider: "gemni" });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "PROVIDER");
    assert.match(result.errors[0].message, /gemni/);
  });
});

