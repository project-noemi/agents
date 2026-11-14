import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "../src/server.js";
import { withEnv } from "./helpers/fake-network.js";

// Offline: loopback only, and every server gets its own temp data folder.
const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(pkg, "fixtures");
const architect = readFileSync(join(fixtures, "architect.core.md"), "utf8");
const broken = readFileSync(join(fixtures, "broken.missing-refusal.md"), "utf8");
const CANARY = "sk-arena-canary-91c4";
const ID = /^[a-f0-9]{24}$/;
const clean = {
  NOEMI_PREFERRED_PROVIDER: undefined, NOEMI_FALLBACK_PROVIDERS: undefined, NOEMI_RUNTIME: undefined,
  AI_GW_API_KEY: undefined, AI_GW_BASE_URL: undefined, AI_GW_MAX_RETRIES: undefined,
  GEMINI_TIMEOUT_MS: undefined, XAI_TIMEOUT_MS: undefined,
};

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

async function withStudio(fn) {
  const dataDir = await mkdtemp(join(tmpdir(), "arena-api-"));
  const lines = [];
  const server = createServer({
    env: { NOEMI_HTTP_ALLOWED_HOSTS: "127.0.0.1", NOEMI_STUDIO_DATA_DIR: dataDir },
    repoRoot: fixtures,
    audit: { write: (s) => lines.push(s) },
  });
  const base = await listen(server);
  try {
    return await withEnv(clean, () =>
      fn({ base, audit: () => lines.map((l) => JSON.parse(l)), rawAudit: () => lines.join("") }));
  } finally {
    await close(server);
    await rm(dataDir, { recursive: true, force: true });
  }
}

const post = (base, path, body) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const saveBlueprint = async (base, markdown = architect, name = "Architect") =>
  (await post(base, "/api/blueprints", { name, markdown })).json();

/** POST /api/arena and return the parsed SSE events plus the raw stream text. */
async function arenaEvents(base, body) {
  const res = await post(base, "/api/arena", body);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/event-stream/);
  const raw = await res.text();
  const events = raw.split("\n\n").filter(Boolean).map((block) => {
    assert.match(block, /^data: /);
    return JSON.parse(block.slice("data: ".length));
  });
  return { events, raw };
}

test("arena: mock answers, and live providers without a key are recorded as failed", () =>
  withStudio(async ({ base, audit, rawAudit }) => {
    const bp = await saveBlueprint(base);
    const prompt = "summarize the private notes of Jane Example";
    const { events } = await arenaEvents(base, { blueprintId: bp.id, prompt });

    assert.equal(events[0].type, "arena");
    assert.match(events[0].id, ID);
    assert.deepEqual([events[0].blueprint, events[0].providers], ["coding/architect", ["mock", "gemini", "xai"]]);
    assert.deepEqual(events.at(-1), { type: "end", id: events[0].id });

    const mock = events.filter((e) => e.provider === "mock");
    assert.deepEqual(mock[0], { type: "start", provider: "mock" });
    const text = mock.filter((e) => e.type === "token").map((e) => e.text).join("");
    assert.match(text, /^\[mock\] compiled coding\/architect/);
    assert.match(text, /Jane Example/);
    const done = mock.at(-1);
    assert.deepEqual([done.type, done.model], ["done", "mock-hello-world"]);
    assert.ok(Number.isInteger(done.usage.latencyMs) && done.usage.latencyMs >= 0);

    const failed = events.filter((e) => e.type === "failed");
    assert.deepEqual(failed.map((e) => e.provider).sort(), ["gemini", "xai"]);
    for (const f of failed) {
      assert.equal(f.stage, "provider");
      assert.deepEqual(f.errors.map((e) => e.code), ["PROVIDER_CONFIG"]);
    }
    assert.equal(events.filter((e) => e.type === "done").length, 1);
    assert.equal(events.some((e) => e.type === "start" && e.provider !== "mock"), false);

    const record = audit().find((r) => r.task.startsWith("studio:arena"));
    assert.equal(record.task, "studio:arena:coding/architect");
    assert.deepEqual(record.inputs, [`text:${Buffer.byteLength(architect)}B`]);
    assert.deepEqual(record.actions, ["parse", "validate", "resolve", "run:mock", "failed:gemini", "failed:xai"]);
    assert.deepEqual(record.risks, ["gemini: PROVIDER_CONFIG", "xai: PROVIDER_CONFIG"]);
    assert.equal(record.result, "partial:PROVIDER_CONFIG,PROVIDER_CONFIG");
    assert.ok(!rawAudit().includes("Jane"), "the prompt never reaches the audit record");
  }));

test("arena: live providers run concurrently, a 503 is recorded not replaced, and the key stays on the server", { timeout: 20_000 }, () =>
  withStudio(async ({ base, rawAudit }) => {
    // The gateway answers neither request until BOTH have arrived. A sequential
    // Arena would time out on the first one instead of seeing a 503.
    const held = [];
    const seen = [];
    const gateway = http.createServer((req, res) => {
      seen.push(req.url);
      req.resume();
      req.on("end", () => {
        held.push(res);
        if (held.length < 2) return;
        for (const r of held.splice(0)) {
          r.writeHead(503, { "content-type": "application/json" });
          r.end(`{"error":"down","key":"${CANARY}"}`);
        }
      });
    });
    const gw = await listen(gateway);
    try {
      await withEnv({
        AI_GW_API_KEY: CANARY, AI_GW_BASE_URL: gw, AI_GW_MAX_RETRIES: "0",
        GEMINI_TIMEOUT_MS: "5000", XAI_TIMEOUT_MS: "5000",
        NOEMI_FALLBACK_PROVIDERS: "mock", // must NOT rescue the failed providers
      }, async () => {
        const bp = await saveBlueprint(base);
        const { events, raw } = await arenaEvents(base, { blueprintId: bp.id, prompt: "hi" });

        const failed = events.filter((e) => e.type === "failed").sort((a, b) => a.provider.localeCompare(b.provider));
        const status503 = [{ code: "PROVIDER_HTTP", message: "HTTP 503", status: 503 }];
        assert.deepEqual(failed.map((e) => [e.provider, e.errors]), [["gemini", status503], ["xai", status503]]);
        assert.deepEqual(events.filter((e) => e.type === "done").map((e) => e.provider), ["mock"]);

        assert.equal(seen.length, 2, "one request per live provider, no retries");
        assert.ok(seen.some((u) => u.startsWith("/google/")) && seen.includes("/v1/chat/completions"));
        assert.ok(!raw.includes(CANARY), "the stream never carries the key");
        assert.ok(!rawAudit().includes(CANARY), "the audit never carries the key");
      });
    } finally {
      await close(gateway);
    }
  }));

test("arena: a blueprint that fails validation is one error event and no provider starts", () =>
  withStudio(async ({ base, audit }) => {
    const bp = await saveBlueprint(base, broken, "Broken");
    const { events } = await arenaEvents(base, { blueprintId: bp.id, prompt: "hi" });

    assert.equal(events.length, 1);
    assert.equal(events[0].type, "error");
    assert.equal(events[0].stage, "validate");
    assert.ok(events[0].errors.some((e) => e.code === "MISSING_REFUSAL"));

    const record = audit().find((r) => r.task.startsWith("studio:arena"));
    assert.equal(record.task, "studio:arena");
    assert.match(record.result, /^error:.*MISSING_REFUSAL/);
  }));

test("arena: malformed requests are refused before any stream starts", () =>
  withStudio(async ({ base }) => {
    const bp = await saveBlueprint(base);
    const cases = [
      [{ prompt: "hi" }, 400],
      [{ blueprintId: bp.id }, 400],
      [{ blueprintId: bp.id, prompt: "   " }, 400],
      [{ blueprintId: bp.id, prompt: 5 }, 400],
      [{ blueprintId: bp.id, prompt: "x".repeat(16_001) }, 400],
      [{ blueprintId: "../x", prompt: "hi" }, 400],
      [{ blueprintId: "a".repeat(24), prompt: "hi" }, 404],
      [["not", "an", "object"], 400],
    ];
    for (const [body, status] of cases) {
      const res = await post(base, "/api/arena", body);
      assert.equal(res.status, status, JSON.stringify(body).slice(0, 60));
      const out = await res.json();
      assert.equal(out.ok, false);
      assert.equal(typeof out.message, "string");
    }

    const wrongType = await fetch(`${base}/api/arena`, {
      method: "POST", headers: { "content-type": "text/plain" }, body: "{}",
    });
    assert.equal(wrongType.status, 415);
    assert.equal((await fetch(`${base}/api/arena`)).status, 404, "POST only");
  }));