import assert from "node:assert/strict";
import test from "node:test";
import { runWithFallbacks } from "../src/providers/fallback.js";
import { readSse } from "../src/providers/streaming.js";
import { runXai } from "../src/providers/xai.js";
import { withEnv, withFetch, textResponse } from "./helpers/fake-network.js";

test("SSE parser handles records split across network chunks", async () => {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"hel',
    'lo"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
    'data: [DONE]\n\n',
  ];
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  const values = [];
  for await (const value of readSse({ body })) values.push(value);
  assert.equal(values.length, 2);
  assert.equal(values[0].choices[0].delta.content, "hello");
  assert.equal(values[1].choices[0].delta.content, " world");
});

test("fallback advances when the preferred provider fails before output", async () => {
  const calls = [];
  const result = await runWithFallbacks({
    preferred: "xai",
    fallbacks: ["mock"],
    providers: {
      xai: async () => { calls.push("xai"); const err = new Error("busy"); err.status = 503; throw err; },
      mock: async () => { calls.push("mock"); return { provider: "mock", output: "complete" }; },
    },
  });
  assert.deepEqual(calls, ["xai", "mock"]);
  assert.equal(result.output, "complete");
});

test("fallback is forbidden after any streamed output has been emitted", async () => {
  const calls = [];
  const received = [];
  await assert.rejects(() => runWithFallbacks({
    preferred: "xai",
    fallbacks: ["mock"],
    onToken: (chunk) => received.push(chunk),
    providers: {
      xai: async (_input, onToken) => {
        calls.push("xai");
        onToken("partial answer");
        const err = new Error("connection lost"); err.status = 503; throw err;
      },
      mock: async () => { calls.push("mock"); return { provider: "mock", output: "different answer" }; },
    },
  }), /connection lost/);
  assert.deepEqual(calls, ["xai"]);
  assert.deepEqual(received, ["partial answer"]);
});

test("xAI provider forwards fake SSE deltas and reports final usage", async () => {
  const seen = [];
  const sse = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\\n\\n',
    'data: {"choices":[{"delta":{"content":" world"}}]}\\n\\n',
    'data: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":2}}\\n\\n',
    'data: [DONE]\\n\\n',
  ].join("");
  const fakeFetch = async (url, init) => {
    assert.match(String(url), /chat\\/completions$/);
    assert.equal(init.headers.Authorization, "Bearer placeholder-gateway-key");
    assert.equal(JSON.parse(init.body).stream, true);
    return textResponse(sse, { headers: { "content-type": "text/event-stream" } });
  };
  const ir = {
    id: "coding/test", title: "Test", sections: { Role: "Test role" },
    refusalCriteria: "Refuse unsafe requests.", skills: [], mcp: [],
  };
  await withEnv({
    AI_GW_API_KEY: "placeholder-gateway-key",
    AI_GW_MAX_RETRIES: "0",
    XAI_MODEL: "xai/grok-4.6",
  }, () => withFetch(fakeFetch, async () => {
    const result = await runXai(ir, "say hello", { onToken: (delta) => seen.push(delta) });
    assert.deepEqual(seen, ["Hello", " world"]);
    assert.equal(result.output, "Hello world");
    assert.equal(result.usage.inputTokens, 4);
    assert.equal(result.usage.outputTokens, 2);
  }));
});
