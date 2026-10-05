import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileFile, compileSource } from "../src/compile.js";
import { persona } from "./helpers/persona.js";
import { withEnv } from "./helpers/fake-network.js";

const here = dirname(fileURLToPath(import.meta.url));
const clean = { NOEMI_PREFERRED_PROVIDER: undefined, NOEMI_FALLBACK_PROVIDERS: undefined };
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