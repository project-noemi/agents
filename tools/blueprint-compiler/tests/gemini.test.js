import assert from "node:assert/strict";
import test from "node:test";
import { runGemini } from "../src/providers/gemini.js";

const ir = {
  id: "coding/architect",
  title: "Architect — Coding Agent",
  sections: { Role: "Keep structure sound.\nReview diffs for drift." },
  skills: ["verification/pre-flight-check"],
};

function withEnv(vars, fn) {
  const saved = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return fn().finally(() => {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
}

function withFetch(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

test("missing GEMINI_API_KEY fails closed without ever calling fetch", async () => {
  await withEnv({ GEMINI_API_KEY: undefined }, () =>
    withFetch(
      () => {
        throw new Error("fetch should not have been called");
      },
      async () => {
        await assert.rejects(
          () => runGemini(ir, "hello"),
          (err) => {
            assert.match(err.message, /GEMINI_API_KEY is not set/);
            assert.equal(err.code, "PROVIDER_CONFIG");
            // No .status and not a TypeError -- fallback.js's isFallbackError()
            // must treat this as NOT fallback-worthy, so a missing key fails
            // the whole compile rather than silently degrading to mock/grok.
            assert.equal(Number.isInteger(err.status), false);
            assert.notEqual(err.name, "TypeError");
            return true;
          }
        );
      }
    )
  );
});

test("a successful call returns the mock.js-shaped result with real usage", async () => {
  await withEnv(
    { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-2.5-flash" },
    () =>
      withFetch(
        async (url) => {
          assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent\?key=test-key$/);
          return {
            ok: true,
            json: async () => ({
              candidates: [
                { content: { parts: [{ text: "hello from gemini" }] } },
              ],
              usageMetadata: { promptTokenCount: 42, candidatesTokenCount: 7 },
            }),
          };
        },
        async () => {
          const result = await runGemini(ir, "hello");
          assert.equal(result.provider, "gemini");
          assert.equal(result.model, "gemini-2.5-flash");
          assert.equal(result.output, "hello from gemini");
          assert.equal(result.usage.inputTokens, 42);
          assert.equal(result.usage.outputTokens, 7);
          assert.equal(result.usage.costUsd, 0);
          assert.equal(typeof result.usage.latencyMs, "number");
          assert.ok(result.usage.latencyMs >= 0);
        }
      )
  );
});

test("429 and 5xx responses throw a fallback-eligible error carrying .status", async () => {
  for (const status of [429, 500, 503]) {
    await withEnv({ GEMINI_API_KEY: "test-key" }, () =>
      withFetch(
        async () => ({
          ok: false,
          status,
          text: async () => `synthetic ${status} from the stub`,
        }),
        async () => {
          await assert.rejects(
            () => runGemini(ir, "hello"),
            (err) => {
              assert.equal(err.status, status);
              return true;
            }
          );
        }
      )
    );
  }
});

test("a 4xx auth/validation error throws with .status but is not retried by design", async () => {
  await withEnv({ GEMINI_API_KEY: "bad-key" }, () =>
    withFetch(
      async () => ({
        ok: false,
        status: 403,
        text: async () => "PERMISSION_DENIED",
      }),
      async () => {
        await assert.rejects(
          () => runGemini(ir, "hello"),
          (err) => {
            assert.equal(err.status, 403);
            return true;
          }
        );
      }
    )
  );
});

test("a raw network failure (fetch throwing TypeError) propagates unmodified", async () => {
  await withEnv({ GEMINI_API_KEY: "test-key" }, () =>
    withFetch(
      async () => {
        throw new TypeError("fetch failed");
      },
      async () => {
        await assert.rejects(
          () => runGemini(ir, "hello"),
          (err) => {
            assert.equal(err.name, "TypeError");
            return true;
          }
        );
      }
    )
  );
});
