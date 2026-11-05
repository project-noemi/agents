import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileFile } from "../src/compile.js";
import {
  withEnv,
  withFetch,
  recordFetch,
  jsonResponse,
  errorResponse,
  geminiBody,
  networkFailure,
  timeoutFailure,
} from "./helpers/fake-network.js";

const here = dirname(fileURLToPath(import.meta.url));
const persona = join(here, "..", "fixtures", "architect.core.md");

const geminiThenMock = { AI_GW_API_KEY: "test-key", AI_GW_BASE_URL: undefined, NOEMI_FALLBACK_PROVIDERS: "mock" };

for (const [label, stub] of [
  ["HTTP 503", () => async () => errorResponse(503)],
  ["HTTP 429", () => async () => errorResponse(429)],
  ["network failure", networkFailure],
  ["timeout", timeoutFailure],
]) {
  test(`gemini ${label} falls back to mock and says so`, async () => {
    await withEnv(geminiThenMock, () =>
      withFetch(stub(), async () => {
        const result = await compileFile(persona, { provider: "gemini", prompt: "hi" });
        assert.equal(result.ok, true);
        assert.equal(result.run.provider, "mock");
        assert.equal(result.run.fallbacks.length, 1);
        assert.equal(result.run.fallbacks[0].provider, "gemini");
      })
    );
  });
}

test("gemini success does not touch the fallback chain", async () => {
  const fake = recordFetch(async () => jsonResponse(geminiBody("hello from gemini")));
  await withEnv(geminiThenMock, () =>
    withFetch(fake, async () => {
      const result = await compileFile(persona, { provider: "gemini" });
      assert.equal(result.run.provider, "gemini");
      assert.deepEqual(result.run.fallbacks, []);
      assert.equal(fake.calls.length, 1);
    })
  );
});

test("gemini 403 fails closed even with a fallback configured", async () => {
  await withEnv(geminiThenMock, () =>
    withFetch(async () => errorResponse(403, "PERMISSION_DENIED"), async () => {
      const result = await compileFile(persona, { provider: "gemini" });
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "PROVIDER_HTTP");
      assert.equal(result.errors[0].status, 403);
    })
  );
});

test("missing AI_GW_API_KEY fails closed even with a fallback configured", async () => {
  await withEnv({ ...geminiThenMock, AI_GW_API_KEY: undefined }, () =>
    withFetch(() => { throw new Error("fetch must not run"); }, async () => {
      const result = await compileFile(persona, { provider: "gemini" });
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "PROVIDER_CONFIG");
    })
  );
});

test("gemini failing with no fallback returns a structured error, not a throw", async () => {
  await withEnv({ AI_GW_API_KEY: "k", NOEMI_FALLBACK_PROVIDERS: undefined }, () =>
    withFetch(async () => errorResponse(503), async () => {
      const result = await compileFile(persona, { provider: "gemini" });
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].status, 503);
    })
  );
});

test("config alone (no explicit provider) selects gemini and its fallbacks", async () => {
  await withEnv({ ...geminiThenMock, NOEMI_PREFERRED_PROVIDER: "gemini" }, () =>
    withFetch(async () => errorResponse(500), async () => {
      const result = await compileFile(persona);
      assert.equal(result.run.provider, "mock");
      assert.equal(result.run.fallbacks[0].provider, "gemini");
    })
  );
});

test("a timeout with no fallback returns a string error code, not DOMException's numeric 23", async () => {
  await withEnv({ AI_GW_API_KEY: "k", NOEMI_FALLBACK_PROVIDERS: undefined }, () =>
    withFetch(timeoutFailure(), async () => {
      const result = await compileFile(persona, { provider: "gemini" });
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "PROVIDER_UNAVAILABLE");
    })
  );
});