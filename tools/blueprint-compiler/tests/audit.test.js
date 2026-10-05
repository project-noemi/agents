import assert from "node:assert/strict";
import test from "node:test";
import { auditFromCompile, writeAudit } from "../src/audit.js";

const KEYS = ["actions", "inputs", "result", "risks", "task"];

test("success record keeps the existing shape", () => {
  const rec = auditFromCompile(
    {
      ok: true,
      ir: { id: "coding/architect" },
      run: { provider: "gemini", fallbacks: [{ provider: "xai", reason: "HTTP 503" }] },
    },
    { file: "f.md", provider: "xai" }
  );
  assert.deepEqual(Object.keys(rec).sort(), KEYS);
  assert.deepEqual(rec.actions, ["parse", "validate", "fallback-from:xai", "run:gemini"]);
  assert.equal(rec.result, "ok");
});

test("failure record carries stage actions and error codes", () => {
  const rec = auditFromCompile(
    { ok: false, stage: "validate", errors: [{ code: "MISSING_REFUSAL", message: "m" }] },
    { file: "f.md" }
  );
  assert.deepEqual(Object.keys(rec).sort(), KEYS);
  assert.deepEqual(rec.actions, ["parse", "validate"]);
  assert.equal(rec.result, "error:MISSING_REFUSAL");
  assert.deepEqual(rec.inputs, ["f.md", "(from config)"]);
});

test("writeAudit emits exactly one JSON line", () => {
  const chunks = [];
  writeAudit({ task: "t", inputs: [], actions: [], risks: [], result: "ok" }, { write: (s) => chunks.push(s) });
  assert.equal(chunks.length, 1);
  assert.ok(chunks[0].endsWith("\n"));
  assert.equal(chunks[0].trim().split("\n").length, 1);
  assert.equal(JSON.parse(chunks[0]).task, "t");
});