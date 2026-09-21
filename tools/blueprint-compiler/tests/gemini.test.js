import assert from "node:assert/strict";
import test from "node:test";
import { runGemini } from "../src/providers/gemini.js";
import {
  withEnv,
  withFetch,
  recordFetch,
  jsonResponse,
  geminiBody,
  timeoutFailure,
} from "./helpers/fake-network.js";

const ir = {
  id: "coding/architect",
  title: "Architect — Coding Agent",
  sections: { Role: "Keep structure sound.\nReview diffs for drift." },
  skills: ["verification/pre-flight-check"],
};

test("missing AI_GW_API_KEY fails closed without ever calling fetch", async () => {
  await withEnv({ AI_GW_API_KEY: undefined }, () =>
    withFetch(
      () => {
        throw new Error("fetch should not have been called");
      },
      async () => {
        await assert.rejects(
          () => runGemini(ir, "hello"),
          (err) => {
            assert.match(err.message, /AI_GW_API_KEY is not set/);
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
    { AI_GW_API_KEY: "test-key", AI_GW_BASE_URL: undefined, GEMINI_MODEL: undefined },
    () =>
      withFetch(
        async (url, init) => {
          assert.equal(
            String(url),
            "https://ai-gw.newpush.com/google/v1beta/models/gemini-3.8-flash:generateContent"
          );
          assert.equal(init.headers.Authorization, "Bearer test-key");
          assert.equal(init.headers["x-goog-api-key"], undefined, "no Google-style key header");
          assert.ok(!String(url).includes("test-key"), "key must never appear in the URL");
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
          assert.equal(result.model, "gemini-3.8-flash");
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

test("a google/-prefixed model is sent bare on the Google-native surface", async () => {
  const fake = recordFetch(async () => jsonResponse(geminiBody("ok")));
  await withEnv(
    { AI_GW_API_KEY: "test-key", AI_GW_BASE_URL: undefined, GEMINI_MODEL: "google/gemini-3.1-pro-preview" },
    () =>
      withFetch(fake, async () => {
        const result = await runGemini(ir, "hello");
        assert.equal(
          fake.calls[0].url,
          "https://ai-gw.newpush.com/google/v1beta/models/gemini-3.1-pro-preview:generateContent"
        );
        assert.equal(result.model, "gemini-3.1-pro-preview");
      })
  );
});

test("AI_GW_BASE_URL overrides the gateway origin", async () => {
  const fake = recordFetch(async () => jsonResponse(geminiBody("ok")));
  await withEnv(
    { AI_GW_API_KEY: "test-key", AI_GW_BASE_URL: "https://gw.example.test/", GEMINI_MODEL: undefined },
    () =>
      withFetch(fake, async () => {
        await runGemini(ir, "hello");
        assert.equal(
          fake.calls[0].url,
          "https://gw.example.test/google/v1beta/models/gemini-3.8-flash:generateContent"
        );
      })
  );
});

test("429 and 5xx responses throw a fallback-eligible error carrying .status", async () => {
  for (const status of [429, 500, 503]) {
    await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
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
  await withEnv({ AI_GW_API_KEY: "bad-key" }, () =>
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
  await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
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

test("every request carries a timeout signal so a hung call can fall back", async () => {
  const fake = recordFetch(async () => jsonResponse(geminiBody("ok")));
  await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
    withFetch(fake, async () => {
      await runGemini(ir, "hello");
      assert.ok(fake.calls[0].init.signal instanceof AbortSignal);
    })
  );
});

test("a timeout propagates as TimeoutError (fallback-eligible)", async () => {
  await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
    withFetch(timeoutFailure(), async () => {
      await assert.rejects(() => runGemini(ir, "hello"), (err) => err.name === "TimeoutError");
    })
  );
});