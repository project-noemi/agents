import assert from "node:assert/strict";
import test from "node:test";
import { parseBlueprint } from "../src/parse.js";
import { validateBlueprint } from "../src/validate.js";
import { persona } from "./helpers/persona.js";

const check = (md) => validateBlueprint(parseBlueprint(md, { source: { kind: "file", ref: "x.md" } }));
const codes = (md) => check(md).map((e) => e.code);

test("a complete persona validates", () => assert.deepEqual(check(persona()), []));

test("a prose mention of refusal criteria fails closed", () => {
  assert.deepEqual(codes(persona({ rules: "1. Be safe.\nNo refusal criteria are defined here." })), ["MISSING_REFUSAL"]);
});

test("an empty Refusal Criteria subsection fails closed", () => {
  assert.deepEqual(codes(persona({ rules: "1. Be safe.\n\n### Refusal Criteria\n" })), ["MISSING_REFUSAL"]);
});

test("Refusal Criteria under the wrong section fails closed", () => {
  assert.deepEqual(
    codes(persona({ rules: "1. Be safe.", boundaries: "### Refusal Criteria\n1. a" })),
    ["MISSING_REFUSAL"]
  );
});

test("a top-level ## Refusal Criteria is not accepted (§5 requires ### under Rules)", () => {
  assert.deepEqual(
    codes(persona({ rules: "1. Be safe.", tail: "\n## Refusal Criteria\n1. a\n" })),
    ["MISSING_REFUSAL"]
  );
});

test("lowercase headings still satisfy the required list", () => {
  assert.deepEqual(check(persona().replace("## Mission", "## mission")), []);
});