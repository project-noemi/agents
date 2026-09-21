import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileFile } from "../src/compile.js";
import {
  withEnv,
  withFetch,
  jsonResponse,
  errorResponse,
  geminiBody,
  xaiBody,
  routeFetch,
  timeoutFailure,
} from "./helpers/fake-network.js";

const here = dirname(fileURLToPath(import.meta.url));
const persona = join(here, "..", "fixtures", "architect.core.md");

const GEMINI_HOST = "generativelanguage.googleapis.com";
const XAI_HOST = "api.x.ai";
const bothKeys = { GEMINI_API_KEY: "g-key", XAI_API_KEY: "x-key" };

test("preferred xai succeeds: no fallback, gemini is never contacted", async () => {
  await withEnv({ ...bothKeys, NOEMI_FALLBACK_PROVIDERS: "gemini,mock" }, () =>
    withFetch(
      routeFetch({ [XAI_HOST]: async () => jsonResponse(xaiBody("from grok")) }),
      async () => {
        const result = await compileFile(persona, { provider: "xai" });
        assert.equal(result.run.provider, "xai");
        assert.equal(result.run.output, "from grok");
        assert.deepEqual(result.run.fallbacks, []);
      }
    )
  );
});

test("xai 503 falls back to gemini (a real provider, not mock)", async () => {
  await withEnv({ ...bothKeys, NOEMI_FALLBACK_PROVIDERS: "gemini,mock" }, () =>
    withFetch(
      routeFetch({
        [XAI_HOST]: async () => errorResponse(503),
        [GEMINI_HOST]: async () => jsonResponse(geminiBody("from gemini")),
      }),
      async () => {
        const result = await compileFile(persona, { provider: "xai" });
        assert.equal(result.run.provider, "gemini");
        assert.deepEqual(result.run.fallbacks, [{ provider: "xai", reason: "HTTP 503" }]);
      }
    )
  );
});

test("gemini 429 falls back to xai", async () => {
  await withEnv({ ...bothKeys, NOEMI_FALLBACK_PROVIDERS: "xai,mock" }, () =>
    withFetch(
      routeFetch({
        [GEMINI_HOST]: async () => errorResponse(429),
        [XAI_HOST]: async () => jsonResponse(xaiBody("from grok")),
      }),
      async () => {
        const result = await compileFile(persona, { provider: "gemini" });
        assert.equal(result.run.provider, "xai");
        assert.deepEqual(result.run.fallbacks, [{ provider: "gemini", reason: "HTTP 429" }]);
      }
    )
  );
});

test("both live providers down: the chain ends on mock and records both failures", async () => {
  await withEnv({ ...bothKeys, NOEMI_FALLBACK_PROVIDERS: "gemini,mock" }, () =>
    withFetch(
      routeFetch({
        [XAI_HOST]: timeoutFailure(),
        [GEMINI_HOST]: async () => errorResponse(500),
      }),
      async () => {
        const result = await compileFile(persona, { provider: "xai" });
        assert.equal(result.run.provider, "mock");
        assert.deepEqual(result.run.fallbacks.map((f) => f.provider), ["xai", "gemini"]);
        assert.deepEqual(result.run.fallbacks.map((f) => f.reason), ["TimeoutError", "HTTP 500"]);
      }
    )
  );
});

test("xai 403 fails closed even with fallbacks configured", async () => {
  await withEnv({ ...bothKeys, NOEMI_FALLBACK_PROVIDERS: "gemini,mock" }, () =>
    withFetch(
      routeFetch({
        [XAI_HOST]: async () => errorResponse(403, "PERMISSION_DENIED"),
        [GEMINI_HOST]: async () => { throw new Error("gemini must not be contacted"); },
      }),
      async () => {
        const result = await compileFile(persona, { provider: "xai" });
        assert.equal(result.ok, false);
        assert.equal(result.errors[0].code, "PROVIDER_HTTP");
        assert.equal(result.errors[0].status, 403);
      }
    )
  );
});

test("missing XAI_API_KEY fails closed even with fallbacks configured", async () => {
  await withEnv({ ...bothKeys, XAI_API_KEY: undefined, NOEMI_FALLBACK_PROVIDERS: "gemini,mock" }, () =>
    withFetch(() => { throw new Error("fetch must not run"); }, async () => {
      const result = await compileFile(persona, { provider: "xai" });
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "PROVIDER_CONFIG");
      assert.match(result.errors[0].message, /XAI_API_KEY/);
    })
  );
});

test("config alone selects xai first, then the configured fallbacks in order", async () => {
  await withEnv(
    { ...bothKeys, NOEMI_PREFERRED_PROVIDER: "xai", NOEMI_FALLBACK_PROVIDERS: "gemini,mock" },
    () =>
      withFetch(
        routeFetch({
          [XAI_HOST]: async () => errorResponse(502),
          [GEMINI_HOST]: async () => jsonResponse(geminiBody("from gemini")),
        }),
        async () => {
          const result = await compileFile(persona);
          assert.equal(result.run.provider, "gemini");
          assert.equal(result.run.fallbacks[0].provider, "xai");
        }
      )
  );
});

test("the grok alias is not silently accepted: 'grok' is an unknown preferred provider", async () => {
  await withEnv({ ...bothKeys, NOEMI_FALLBACK_PROVIDERS: "mock" }, async () => {
    const result = await compileFile(persona, { provider: "grok" });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "PROVIDER");
    assert.match(result.errors[0].message, /xai/);
  });
});
