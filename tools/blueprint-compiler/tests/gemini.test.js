import assert from "node:assert/strict";
import test from "node:test";
import { runGemini } from "../src/providers/gemini.js";
import { isFallbackError } from "../src/providers/fallback.js";
import {
  withEnv,
  withFetch,
  recordFetch,
  sseResponse,
  geminiBody,
  timeoutFailure,
} from "./helpers/fake-network.js";

const ir = {
  id: "coding/architect",
  title: "Architect — Coding Agent",
  sections: { Role: "Keep structure sound.\nReview diffs for drift." },
  skills: ["verification/pre-flight-check"],
};

const geminiSse = (body) => sseResponse([body]);

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
            "https://ai-gw.newpush.com/google/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse"
          );
          assert.equal(init.headers.Authorization, "Bearer test-key");
          assert.equal(init.headers["x-goog-api-key"], undefined, "no Google-style key header");
          assert.ok(!String(url).includes("test-key"), "key must never appear in the URL");
          return sseResponse([
            {
              candidates: [
                {
                  content: { parts: [{ text: "hello from gemini" }] },
                  finishReason: "STOP",
                },
              ],
              usageMetadata: { promptTokenCount: 42, candidatesTokenCount: 7 },
            },
          ]);
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
  const fake = recordFetch(async () => geminiSse(geminiBody("ok")));
  await withEnv(
    { AI_GW_API_KEY: "test-key", AI_GW_BASE_URL: undefined, GEMINI_MODEL: "google/gemini-3.1-pro-preview" },
    () =>
      withFetch(fake, async () => {
        const result = await runGemini(ir, "hello");
        assert.equal(
          fake.calls[0].url,
          "https://ai-gw.newpush.com/google/v1beta/models/gemini-3.1-pro-preview:streamGenerateContent?alt=sse"
        );
        assert.equal(result.model, "gemini-3.1-pro-preview");
      })
  );
});

test("AI_GW_BASE_URL overrides the gateway origin", async () => {
  const fake = recordFetch(async () => geminiSse(geminiBody("ok")));
  await withEnv(
    { AI_GW_API_KEY: "test-key", AI_GW_BASE_URL: "https://gw.example.test/", GEMINI_MODEL: undefined },
    () =>
      withFetch(fake, async () => {
        await runGemini(ir, "hello");
        assert.equal(
          fake.calls[0].url,
          "https://gw.example.test/google/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse"
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
  const fake = recordFetch(async () => geminiSse(geminiBody("ok")));
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

const blueprint = { ...ir, refusalCriteria: "1. Refused Task Types: deleting prod." };

test("persona context goes in systemInstruction, and the user turn is only the prompt", async () => {
  const fake = recordFetch(async () => geminiSse(geminiBody("ok")));
  await withEnv({ AI_GW_API_KEY: "test-key", AI_GW_BASE_URL: undefined }, () =>
    withFetch(fake, () => runGemini(blueprint, "hello")));
  const body = JSON.parse(fake.calls[0].init.body);
  const system = body.systemInstruction.parts[0].text;
  assert.match(system, /NoéMI persona "Architect — Coding Agent"/);
  assert.match(system, /Refused Task Types: deleting prod\./);
  assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: "hello" }] }]);
});

test("blocked, filtered, or empty responses fail closed with PROVIDER_EMPTY", async () => {
  const cases = [
    { promptFeedback: { blockReason: "SAFETY" } },
    { candidates: [] },
    {},
    { candidates: [{ finishReason: "SAFETY", content: { parts: [{ text: "partial" }] } }] },
    { candidates: [{ finishReason: "RECITATION", content: { parts: [{ text: "x" }] } }] },
    geminiBody(""),
    geminiBody("  \n"),
    { candidates: [{ finishReason: "STOP" }] },
  ];
  for (const body of cases) {
    await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
      withFetch(async () => geminiSse(body), async () => {
        await assert.rejects(() => runGemini(blueprint, "hello"), (err) => {
          assert.equal(err.code, "PROVIDER_EMPTY", JSON.stringify(body));
          assert.equal(isFallbackError(err), false);
          return true;
        });
      })
    );
  }
});

test("MAX_TOKENS with text is a normal (truncated) answer, not an error", async () => {
  const body = {
    candidates: [
      { finishReason: "MAX_TOKENS", content: { parts: [{ text: "long" }] } },
    ],
  };
  await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
    withFetch(async () => geminiSse(body), async () => {
      assert.equal((await runGemini(blueprint, "hello")).output, "long");
    })
  );
});