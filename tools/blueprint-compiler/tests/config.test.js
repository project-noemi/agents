import assert from "node:assert/strict";
import test from "node:test";
import { loadModelPolicy } from "../src/config.js";
import { withEnv } from "./helpers/fake-network.js";

test("defaults to mock with no fallbacks", () => {
  assert.deepEqual(loadModelPolicy({}), { preferred: "mock", fallbacks: [] });
});

test("trims values, drops empties, preserves fallback order", () => {
  const p = loadModelPolicy({
    NOEMI_PREFERRED_PROVIDER: " xai ",
    NOEMI_FALLBACK_PROVIDERS: " gemini , ,mock ",
  });
  assert.deepEqual(p, { preferred: "xai", fallbacks: ["gemini", "mock"] });
});

test("an empty NOEMI_PREFERRED_PROVIDER means unset", () => {
  assert.equal(loadModelPolicy({ NOEMI_PREFERRED_PROVIDER: "" }).preferred, "mock");
});

test("reads process.env at call time, not import time", async () => {
  await withEnv({ NOEMI_PREFERRED_PROVIDER: "gemini" }, async () => {
    assert.equal(loadModelPolicy().preferred, "gemini");
  });
});