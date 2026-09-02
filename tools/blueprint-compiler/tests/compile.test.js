import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileFile } from "../src/compile.js";
import { parseBlueprint } from "../src/parse.js";
import { validateBlueprint } from "../src/validate.js";

const root = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(root, "..", "fixtures", name);

test("parses a valid persona and extracts skill refs", async () => {
  const result = await compileFile(fixture("architect.core.md"), {
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

test("refuses unknown providers in Sprint 1", async () => {
  const result = await compileFile(fixture("architect.core.md"), {
    provider: "anthropic",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "PROVIDER");
});
