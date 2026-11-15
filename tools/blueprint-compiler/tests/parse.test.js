import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseBlueprint } from "../src/parse.js";
import { persona } from "./helpers/persona.js";
import { withEnv } from "./helpers/fake-network.js";

const root = dirname(fileURLToPath(import.meta.url));
const source = { kind: "file", ref: "x.md" };
const parse = (md, opts = {}) => parseBlueprint(md, { source, ...opts });

test("extracts the Refusal Criteria body from the architect fixture", () => {
  const md = readFileSync(join(root, "..", "fixtures", "architect.core.md"), "utf8");
  const { refusalCriteria } = parse(md);
  assert.match(refusalCriteria, /^1\. Refused Task Types:/);
  assert.match(refusalCriteria, /Escalation Path/);
  assert.doesNotMatch(refusalCriteria, /Data Inventory/);
});

test("the body stops at the next heading but keeps #### subheadings", () => {
  const ir = parse(persona({ rules: "### Refusal Criteria\n1. a\n#### Detail\n2. b\n### Other\nzzz" }));
  assert.match(ir.refusalCriteria, /Detail/);
  assert.doesNotMatch(ir.refusalCriteria, /zzz/);
});

test("the heading matches case-insensitively and with a trailing colon", () => {
  assert.equal(parse(persona({ rules: "### refusal criteria:\n1. a" })).refusalCriteria, "1. a");
});

test("a Refusal Criteria heading outside Rules & Constraints does not count", () => {
  const ir = parse(persona({ rules: "1. Be safe.", boundaries: "### Refusal Criteria\n1. a" }));
  assert.equal(ir.refusalCriteria, "");
});

test("a prose mention is not a subsection", () => {
  assert.equal(parse(persona({ rules: "No refusal criteria are defined here." })).refusalCriteria, "");
});

test("an empty or comment-only body yields an empty string", () => {
  assert.equal(parse(persona({ rules: "### Refusal Criteria\n\n" })).refusalCriteria, "");
  assert.equal(parse(persona({ rules: "### Refusal Criteria\n<!-- TODO -->" })).refusalCriteria, "");
});

test("CRLF input parses the same", () => {
  const ir = parse(persona().replace(/\n/g, "\r\n"));
  assert.match(ir.refusalCriteria, /Refused Task Types/);
});

test("skills and mcp are extracted, deduped, and not sanitized", () => {
  const ir = parse(persona({
    workflow: "**Skill:** `a/b`\n**Skill:** `a/b`\n**MCP:** `slack`\n**MCP:** `../escape`",
  }));
  assert.deepEqual(ir.skills, ["a/b"]);
  assert.deepEqual(ir.mcp, ["slack", "../escape"]);
});

test("required headings match case-insensitively", () => {
  const ir = parse(persona().replace("## Role", "## role"));
  assert.equal(ir.sections.Role, "Test role.");
});

test("parse is pure: env does not leak into modelPolicy", async () => {
  await withEnv({ NOEMI_PREFERRED_PROVIDER: "xai", NOEMI_FALLBACK_PROVIDERS: "gemini" }, async () => {
    assert.deepEqual(parse(persona()).modelPolicy, { preferred: "mock", fallbacks: [] });
  });
  const ir = parse(persona(), { modelPolicy: { preferred: "xai", fallbacks: ["mock"] } });
  assert.deepEqual(ir.modelPolicy, { preferred: "xai", fallbacks: ["mock"] });
});

test("parse.js never touches process.env", () => {
  assert.doesNotMatch(readFileSync(join(root, "..", "src", "parse.js"), "utf8"), /process\.env/);
});