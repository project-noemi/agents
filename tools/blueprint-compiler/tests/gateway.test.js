import assert from "node:assert/strict";
import test from "node:test";
import { loadGatewayConfig, postJson } from "../src/providers/gateway.js";
import { isFallbackError } from "../src/providers/fallback.js";
import { withFetch, recordFetch, jsonResponse, errorResponse } from "./helpers/fake-network.js";

const timeoutVar = "GEMINI_TIMEOUT_MS";
const env = (vars) => ({ AI_GW_API_KEY: "test-key", ...vars });
const config = (vars = {}) => loadGatewayConfig({ timeoutVar }, env({ AI_GW_RETRY_BASE_MS: "0", ...vars }));

test("defaults: NewPush origin, 30s timeout, 3 retries with a 1s base", () => {
  const c = loadGatewayConfig({ timeoutVar }, env({}));
  assert.equal(c.gateway, "https://ai-gw.newpush.com");
  assert.equal(c.timeoutMs, 30_000);
  assert.equal(c.maxRetries, 3);
  assert.equal(c.retryBaseMs, 1_000);
});

test("a blank or whitespace key is missing, not a key", () => {
  for (const AI_GW_API_KEY of [undefined, "", "   "]) {
    assert.throws(() => loadGatewayConfig({ timeoutVar }, { AI_GW_API_KEY }), (err) => {
      assert.equal(err.code, "PROVIDER_CONFIG");
      assert.match(err.message, /AI_GW_API_KEY is not set/);
      return true;
    });
  }
});

test("bad AI_GW_BASE_URL values fail closed with PROVIDER_CONFIG", () => {
  for (const AI_GW_BASE_URL of [
    "not a url",
    "http://ai-gw.newpush.com",          // key would go out in clear text
    "ftp://ai-gw.newpush.com",
    "https://gw.example.test/?x=1",
    "https://user:pw@gw.example.test",
  ]) {
    assert.throws(() => config({ AI_GW_BASE_URL }), (err) => {
      assert.equal(err.code, "PROVIDER_CONFIG", AI_GW_BASE_URL);
      assert.equal(isFallbackError(err), false);
      assert.ok(!err.message.includes("test-key"), "the key never appears in an error");
      return true;
    });
  }
});

test("plain http is allowed only for a local gateway", () => {
  assert.equal(config({ AI_GW_BASE_URL: "http://localhost:8787/" }).gateway, "http://localhost:8787");
  assert.equal(config({ AI_GW_BASE_URL: "http://127.0.0.1:8787" }).gateway, "http://127.0.0.1:8787");
});

test("a non-numeric, zero, or fractional timeout is a config error, not a silent default", () => {
  for (const value of ["abc", "0", "-5", "1.5"]) {
    assert.throws(() => config({ [timeoutVar]: value }), (err) =>
      err.code === "PROVIDER_CONFIG" && err.message.includes(timeoutVar));
  }
  assert.equal(config({ [timeoutVar]: " 5000 " }).timeoutMs, 5000);
  assert.equal(config({ [timeoutVar]: "" }).timeoutMs, 30_000);
});

test("retry settings are validated too; 0 retries is allowed", () => {
  assert.equal(config({ AI_GW_MAX_RETRIES: "0" }).maxRetries, 0);
  assert.throws(() => config({ AI_GW_MAX_RETRIES: "-1" }), (err) => err.code === "PROVIDER_CONFIG");
  assert.throws(() => config({ AI_GW_RETRY_BASE_MS: "soon" }), (err) => err.code === "PROVIDER_CONFIG");
});

test("429 and 5xx are retried with backoff, then the call succeeds", async () => {
  const fake = recordFetch(async (_url, _init, n) =>
    n === 1 ? errorResponse(429) : n === 2 ? errorResponse(503) : jsonResponse({ ok: 1 }));
  await withFetch(fake, async () => {
    assert.deepEqual(await postJson("https://gw.test/x", {}, config(), "gemini"), { ok: 1 });
  });
  assert.equal(fake.calls.length, 3);
});

test("retries are exhausted, then the last fallback-worthy error propagates", async () => {
  const fake = recordFetch(async () => errorResponse(503));
  await withFetch(fake, async () => {
    await assert.rejects(() => postJson("https://gw.test/x", {}, config({ AI_GW_MAX_RETRIES: "2" }), "xai"),
      (err) => err.status === 503 && isFallbackError(err));
  });
  assert.equal(fake.calls.length, 3, "1 attempt + 2 retries");
});

test("a network failure is retried", async () => {
  let n = 0;
  await withFetch(async () => {
    n += 1;
    if (n === 1) throw new TypeError("fetch failed");
    return jsonResponse({ ok: 1 });
  }, async () => {
    assert.deepEqual(await postJson("https://gw.test/x", {}, config(), "gemini"), { ok: 1 });
  });
  assert.equal(n, 2);
});

test("4xx and timeouts are not retried", async () => {
  for (const stub of [
    async () => errorResponse(401),
    async () => errorResponse(403),
    async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); },
  ]) {
    const fake = recordFetch(stub);
    await withFetch(fake, async () => {
      await assert.rejects(() => postJson("https://gw.test/x", {}, config(), "gemini"));
    });
    assert.equal(fake.calls.length, 1);
  }
});

test("every retry gets its own timeout signal", async () => {
  const fake = recordFetch(async (_u, _i, n) => (n === 1 ? errorResponse(500) : jsonResponse({})));
  await withFetch(fake, () => postJson("https://gw.test/x", {}, config(), "gemini"));
  assert.ok(fake.calls[0].init.signal instanceof AbortSignal);
  assert.notEqual(fake.calls[0].init.signal, fake.calls[1].init.signal);
});

test("a 200 with an unreadable body is a 502, not a pass", async () => {
  const fake = recordFetch(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("x"); } }));
  await withFetch(fake, async () => {
    await assert.rejects(() => postJson("https://gw.test/x", {}, config({ AI_GW_MAX_RETRIES: "0" }), "gemini"),
      (err) => err.status === 502);
  });
});

test("retries write nothing to stderr (the CLI's audit record owns it)", async () => {
  const warn = console.warn;
  const seen = [];
  console.warn = (...args) => seen.push(args);
  try {
    const fake = recordFetch(async (_u, _i, n) => (n === 1 ? errorResponse(429) : jsonResponse({})));
    await withFetch(fake, () => postJson("https://gw.test/x", {}, config(), "gemini"));
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(seen, []);
});
