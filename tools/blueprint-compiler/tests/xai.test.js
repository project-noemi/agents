import assert from "node:assert/strict";
import test from "node:test";
import { runXai } from "../src/providers/xai.js";
import {
  withEnv,
  withFetch,
  recordFetch,
  jsonResponse,
  errorResponse,
  xaiBody,
  networkFailure,
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
          () => runXai(ir, "hello"),
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
  const fake = recordFetch(async () =>
    jsonResponse(xaiBody("hello from grok", { prompt_tokens: 42, completion_tokens: 7 }))
  );
  await withEnv({ AI_GW_API_KEY: "test-key", XAI_MODEL: undefined }, () =>
    withFetch(fake, async () => {
      const result = await runXai(ir, "hello");
      assert.equal(result.provider, "xai");
      assert.equal(result.model, "xai/grok-4.6");
      assert.equal(result.output, "hello from grok");
      assert.equal(result.usage.inputTokens, 42);
      assert.equal(result.usage.outputTokens, 7);
      assert.equal(result.usage.costUsd, 0);
      assert.equal(typeof result.usage.latencyMs, "number");
      assert.ok(result.usage.latencyMs >= 0);
    })
  );
});

test("the request targets the gateway's chat/completions with a Bearer header and the key never in the URL", async () => {
  const fake = recordFetch(async () => jsonResponse(xaiBody("ok")));
  await withEnv({ AI_GW_API_KEY: "test-key", AI_GW_BASE_URL: undefined, XAI_MODEL: "xai/grok-build-0.1" }, () =>
    withFetch(fake, async () => {
      await runXai(ir, "hello");
      const { url, init } = fake.calls[0];
      assert.equal(url, "https://ai-gw.newpush.com/v1/chat/completions");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer test-key");
      assert.ok(!url.includes("test-key"), "key must never appear in the URL");

      const body = JSON.parse(init.body);
      assert.equal(body.model, "xai/grok-build-0.1");
      assert.equal(body.messages[0].role, "system");
      assert.match(body.messages[0].content, /Architect — Coding Agent/);
      assert.match(body.messages[0].content, /verification\/pre-flight-check/);
      assert.deepEqual(body.messages[1], { role: "user", content: "hello" });
    })
  );
});

test("a bare model id is sent with the xai/ prefix the gateway requires", async () => {
  const fake = recordFetch(async () => jsonResponse(xaiBody("ok")));
  await withEnv({ AI_GW_API_KEY: "test-key", XAI_MODEL: "grok-4.3" }, () =>
    withFetch(fake, async () => {
      const result = await runXai(ir, "hello");
      assert.equal(JSON.parse(fake.calls[0].init.body).model, "xai/grok-4.3");
      assert.equal(result.model, "xai/grok-4.3");
    })
  );
});

test("AI_GW_BASE_URL overrides the gateway origin", async () => {
  const fake = recordFetch(async () => jsonResponse(xaiBody("ok")));
  await withEnv({ AI_GW_API_KEY: "test-key", AI_GW_BASE_URL: "https://gw.example.test/" }, () =>
    withFetch(fake, async () => {
      await runXai(ir, "hello");
      assert.equal(fake.calls[0].url, "https://gw.example.test/v1/chat/completions");
    })
  );
});

test("429 and 5xx responses throw a fallback-eligible error carrying .status", async () => {
  for (const status of [429, 500, 503]) {
    await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
      withFetch(async () => errorResponse(status), async () => {
        await assert.rejects(
          () => runXai(ir, "hello"),
          (err) => {
            assert.equal(err.status, status);
            return true;
          }
        );
      })
    );
  }
});

test("a 4xx auth/validation error throws with .status but is not retried by design", async () => {
  await withEnv({ AI_GW_API_KEY: "bad-key" }, () =>
    withFetch(async () => errorResponse(403, "PERMISSION_DENIED"), async () => {
      await assert.rejects(
        () => runXai(ir, "hello"),
        (err) => {
          assert.equal(err.status, 403);
          return true;
        }
      );
    })
  );
});

test("a raw network failure (fetch throwing TypeError) propagates unmodified", async () => {
  await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
    withFetch(networkFailure(), async () => {
      await assert.rejects(
        () => runXai(ir, "hello"),
        (err) => {
          assert.equal(err.name, "TypeError");
          return true;
        }
      );
    })
  );
});

test("every request carries a timeout signal so a hung call can fall back", async () => {
  const fake = recordFetch(async () => jsonResponse(xaiBody("ok")));
  await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
    withFetch(fake, async () => {
      await runXai(ir, "hello");
      assert.ok(fake.calls[0].init.signal instanceof AbortSignal);
    })
  );
});

test("a timeout propagates as TimeoutError (fallback-eligible)", async () => {
  await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
    withFetch(timeoutFailure(), async () => {
      await assert.rejects(() => runXai(ir, "hello"), (err) => err.name === "TimeoutError");
    })
  );
});

test("an empty completion yields empty output instead of throwing", async () => {
  await withEnv({ AI_GW_API_KEY: "test-key" }, () =>
    withFetch(async () => jsonResponse({ choices: [] }), async () => {
      const result = await runXai(ir, "hello");
      assert.equal(result.output, "");
      assert.equal(result.usage.inputTokens, 0);
    })
  );
});
