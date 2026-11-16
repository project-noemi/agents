import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadPriceTable, loadServerConfig, modelKey } from "../src/config.js";
import { compileText } from "../src/compile.js";
import { costUsd } from "../src/pricing.js";
import { createThrottle } from "../src/throttle.js";
import { createSpendLedger } from "../src/store/spend.js";
import { arenaRecordFrom, createArenaStore, scoreboardFrom } from "../src/store/arena.js";
import { createServer } from "../src/server.js";
import { withEnv } from "./helpers/fake-network.js";
import { withLocalGateway } from "./helpers/fake-gateway.js";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(pkg, "fixtures");
const architect = readFileSync(join(fixtures, "architect.core.md"), "utf8");
const STUDIO_TOKEN = "t".repeat(40);
const fetch = (url, init = {}) =>
  globalThis.fetch(url, { ...init, headers: { authorization: `Bearer ${STUDIO_TOKEN}`, ...init.headers } });
const clean = {
  NOEMI_PREFERRED_PROVIDER: undefined, NOEMI_FALLBACK_PROVIDERS: undefined, NOEMI_RUNTIME: undefined,
  NOEMI_PRICE_TABLE: undefined, AI_GW_API_KEY: undefined, AI_GW_BASE_URL: undefined, AI_GW_MAX_RETRIES: undefined,
  GEMINI_MODEL: undefined, XAI_MODEL: undefined, GEMINI_TIMEOUT_MS: undefined, XAI_TIMEOUT_MS: undefined,
};
const tmp = () => mkdtemp(join(tmpdir(), "cost-controls-"));

// ---- price table and cost -------------------------------------------------

test("price table: defaults, override, vendor prefix ignored, bad JSON fails without echoing it", () => {
  assert.equal(loadPriceTable({}).get("mock-hello-world").inputPerMTok, 0);
  // The two default live models are priced out of the box (provider ids carry a vendor prefix).
  assert.deepEqual(loadPriceTable({}).get(modelKey("google/gemini-3.8-flash")), { inputPerMTok: 0.75, outputPerMTok: 3.75 });
  assert.deepEqual(loadPriceTable({}).get(modelKey("xai/grok-4.6")), { inputPerMTok: 2, outputPerMTok: 6 });

  const table = loadPriceTable({ NOEMI_PRICE_TABLE: '{"google/m1":{"inputPerMTok":1.5,"outputPerMTok":6}}' });
  assert.deepEqual(table.get("m1"), { inputPerMTok: 1.5, outputPerMTok: 6 });

  for (const bad of ["not json", "[]", '{"m":{"inputPerMTok":-1,"outputPerMTok":1}}', '{"m":{"inputPerMTok":"1","outputPerMTok":1}}', '{"m":1}']) {
    assert.throws(() => loadPriceTable({ NOEMI_PRICE_TABLE: bad }), (e) => e.code === "PROVIDER_CONFIG" && !e.message.includes(bad));
  }
});

test("costUsd: per-million-token maths, null for an unpriced model", () => {
  const prices = loadPriceTable({ NOEMI_PRICE_TABLE: '{"m1":{"inputPerMTok":0.30,"outputPerMTok":2.50}}' });
  assert.equal(costUsd({ model: "google/m1", inputTokens: 1000, outputTokens: 2000 }, prices), 0.0053);
  assert.equal(costUsd({ model: "m1", inputTokens: -5, outputTokens: NaN }, prices), 0);
  assert.equal(costUsd({ model: "other", inputTokens: 1, outputTokens: 1 }, prices), null);
  assert.equal(costUsd({ inputTokens: 1 }, prices), null);
});

test("compile: a live answer is priced from the table; the mock stays free; an unpriced model costs 0", () =>
  withLocalGateway((req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "hello" } }] })}\n\n`);
    res.end(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 1000, completion_tokens: 2000 } })}\n\ndata: [DONE]\n\n`);
  }, ({ base }) =>
    withEnv({ ...clean, AI_GW_API_KEY: "sk-test-key", AI_GW_BASE_URL: base, AI_GW_MAX_RETRIES: "0", XAI_MODEL: "grok-test" }, async () => {
      const opts = { repoRoot: fixtures, provider: "xai", fallbacks: [] };

      const unpriced = await compileText(architect, opts);
      assert.equal(unpriced.ok, true);
      assert.equal(unpriced.run.usage.outputTokens, 2000, "the test gateway's usage came through");
      assert.equal(unpriced.run.usage.costUsd, 0, "no price, no invented cost");

      await withEnv({ NOEMI_PRICE_TABLE: '{"grok-test":{"inputPerMTok":2,"outputPerMTok":10}}' }, async () => {
        const priced = await compileText(architect, opts);
        assert.equal(priced.run.usage.costUsd, 0.022, "1000 * $2/M + 2000 * $10/M");
      });

      const mock = await compileText(architect, { repoRoot: fixtures, provider: "mock" });
      assert.equal(mock.run.usage.costUsd, 0);
    })));

test("compile: requirePrice refuses a live provider with no price, and a bad table is a structured error", () =>
  withEnv({ ...clean, AI_GW_API_KEY: "sk-test-key", GEMINI_MODEL: "gemini-unpriced" }, async () => {
    const refused = await compileText(architect, { repoRoot: fixtures, provider: "gemini", requirePrice: true });
    assert.equal(refused.ok, false);
    assert.equal(refused.stage, "provider");
    assert.equal(refused.errors[0].code, "PROVIDER_CONFIG");
    assert.match(refused.errors[0].message, /NOEMI_PRICE_TABLE/);

    // Mock is free and needs no entry.
    assert.equal((await compileText(architect, { repoRoot: fixtures, provider: "mock", requirePrice: true })).ok, true);

    await withEnv({ NOEMI_PRICE_TABLE: "oops" }, async () => {
      const bad = await compileText(architect, { repoRoot: fixtures, provider: "mock" });
      assert.deepEqual([bad.ok, bad.stage, bad.errors[0].code], [false, "provider", "PROVIDER_CONFIG"]);
    });
  }));

// ---- throttle -------------------------------------------------------------

test("throttle: allows max per window, reports when to retry, and frees slots as the window slides", () => {
  let t = 1000;
  const th = createThrottle({ max: 2, windowMs: 100, now: () => t });
  assert.equal(th.take().ok, true);
  t = 1040;
  assert.equal(th.take().ok, true);
  t = 1050;
  const blocked = th.take();
  assert.deepEqual([blocked.ok, blocked.retryAfterMs], [false, 50]);
  assert.equal(th.take().ok, false, "a refused request is not counted");
  t = 1100;
  assert.equal(th.take().ok, true, "the first hit has aged out");
  assert.equal(th.take().ok, false);
});

// ---- spend ledger ---------------------------------------------------------

test("spend ledger: adds up, ignores junk, resets on a new day in the chosen zone, refuses a damaged file", async () => {
  const dir = await tmp();
  try {
    let now = Date.parse("2026-11-15T12:00:00Z");
    const ledger = createSpendLedger({ dir, now: () => now });
    assert.equal(await ledger.spentToday(), 0);
    await ledger.add(0.25);
    await ledger.add(0.5);
    await ledger.add(-1);
    await ledger.add(NaN);
    assert.equal(await ledger.spentToday(), 0.75);

    now = Date.parse("2026-11-16T00:00:01Z");
    assert.equal(await ledger.spentToday(), 0, "a new UTC day starts at zero");

    // 2026-11-16T02:00Z is still 15 Nov evening in Denver (UTC-7).
    const denver = createSpendLedger({ dir, timeZone: "America/Denver", now: () => Date.parse("2026-11-16T02:00:00Z") });
    await denver.add(1);
    const later = createSpendLedger({ dir, timeZone: "America/Denver", now: () => Date.parse("2026-11-16T06:00:00Z") });
    assert.equal(await later.spentToday(), 1.75, "same Denver day: carried on from the 0.75 above");
    const nextDay = createSpendLedger({ dir, timeZone: "America/Denver", now: () => Date.parse("2026-11-16T08:00:00Z") });
    assert.equal(await nextDay.spentToday(), 0, "after Denver midnight");

    await writeFile(join(dir, "spend.json"), "{ not json");
    await assert.rejects(() => ledger.spentToday());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---- arena store and scoreboard ------------------------------------------

const summary = (id, results) => ({ id, blueprint: "coding/architect", at: "2026-11-15T12:00:00.000Z", durationMs: 50, results });
const okRow = (provider, latencyMs, extra = {}) =>
  ({ provider, ok: true, model: "m", inputTokens: 10, outputTokens: 20, latencyMs, costUsd: 0.5, ...extra });
const badRow = (provider) => ({ provider, ok: false, stage: "provider", errorCodes: ["PROVIDER_HTTP"], latencyMs: 9 });

test("arena record keeps codes and numbers only; scoreboard totals per provider", () => {
  const rec = arenaRecordFrom(
    { ...summary("a1", [okRow("mock", 10), badRow("gemini")]), prompt: "SECRET PROMPT", results: [{ ...okRow("mock", 10), output: "SECRET OUTPUT" }, { ...badRow("gemini"), message: "SECRET MSG" }] },
    "b".repeat(24),
  );
  assert.ok(!JSON.stringify(rec).includes("SECRET"));
  assert.equal(rec.blueprintId, "b".repeat(24));

  const rows = scoreboardFrom([
    summary("a1", [okRow("mock", 10), badRow("gemini")]),
    summary("a2", [okRow("mock", 31), okRow("gemini", 100)]),
  ]);
  assert.deepEqual(rows, [
    { provider: "gemini", runs: 2, ok: 1, failed: 1, inputTokens: 10, outputTokens: 20, avgLatencyMs: 100, costUsd: 0.5 },
    { provider: "mock", runs: 2, ok: 2, failed: 0, inputTokens: 20, outputTokens: 40, avgLatencyMs: 21, costUsd: 1 },
  ]);
  assert.deepEqual(scoreboardFrom([summary("a3", [badRow("xai")])]), [
    { provider: "xai", runs: 1, ok: 0, failed: 1, inputTokens: 0, outputTokens: 0, avgLatencyMs: null, costUsd: 0 },
  ]);
  assert.deepEqual(scoreboardFrom([]), []);
});

test("arena store: persists, lists newest first, drops the oldest past the cap, survives a damaged line", async () => {
  const dir = await tmp();
  try {
    const store = createArenaStore({ dir, maxRuns: 2 });
    for (const id of ["r1", "r2", "r3"]) await store.append(arenaRecordFrom(summary(id, [okRow("mock", 5)])));
    assert.deepEqual((await store.list()).map((r) => r.id), ["r3", "r2"]);
    assert.equal((await store.scoreboard())[0].runs, 2);

    const file = join(dir, "arena.jsonl");
    await writeFile(file, `garbage\n${await readFile(file, "utf8")}`);
    assert.equal((await store.list()).length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---- server: scoreboard, cap, throttle -----------------------------------

async function withStudio(extraEnv, fn) {
  const dataDir = await tmp();
  const server = createServer({
    env: { NOEMI_HTTP_ALLOWED_HOSTS: "127.0.0.1", NOEMI_STUDIO_TOKEN: STUDIO_TOKEN, NOEMI_STUDIO_DATA_DIR: dataDir, ...extraEnv },
    repoRoot: fixtures,
    audit: { write: () => {} },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await withEnv(clean, () => fn({ base, dataDir }));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}
const post = (base, path, body) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const saveBlueprint = async (base) => (await post(base, "/api/blueprints", { name: "Architect", markdown: architect })).json();
const arena = async (base, blueprintId) => {
  const res = await post(base, "/api/arena", { blueprintId, prompt: "hi" });
  return { res, text: await res.text() };
};

test("server: an Arena run is saved and the scoreboard serves it, behind the token", () =>
  withStudio({}, async ({ base, dataDir }) => {
    assert.equal((await globalThis.fetch(`${base}/api/arena/runs`)).status, 401);
    assert.deepEqual(await (await fetch(`${base}/api/arena/scoreboard`)).json(), []);

    const bp = await saveBlueprint(base);
    const { res, text } = await arena(base, bp.id);
    assert.equal(res.status, 200);
    assert.ok(text.includes('"type":"end"'));

    const board = await (await fetch(`${base}/api/arena/scoreboard`)).json();
    const mock = board.find((r) => r.provider === "mock");
    assert.deepEqual([mock.runs, mock.ok, mock.failed, mock.costUsd], [1, 1, 0, 0]);
    // No key is set, so the live providers are recorded as failed, not dropped.
    assert.ok(board.filter((r) => r.provider !== "mock").every((r) => r.failed === 1 && r.avgLatencyMs === null));

    const saved = await (await fetch(`${base}/api/arena/runs`)).json();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].blueprintId, bp.id);
    assert.ok(!(await readFile(join(dataDir, "arena.jsonl"), "utf8")).includes("hi\""), "no prompt on disk");
  }));

test("server: the daily cap refuses new runs once spend reaches it, and validate stays open", () =>
  withStudio({ NOEMI_DAILY_SPEND_CAP_USD: "1" }, async ({ base, dataDir }) => {
    const bp = await saveBlueprint(base);
    assert.equal((await arena(base, bp.id)).res.status, 200, "under the cap");

    await createSpendLedger({ dir: dataDir }).add(1);
    const blocked = await arena(base, bp.id);
    assert.equal(blocked.res.status, 429);
    assert.match(JSON.parse(blocked.text).message, /spending cap/);
    const run = await post(base, "/api/run", { input: { kind: "text", markdown: architect }, provider: "mock" });
    assert.equal(run.status, 429);
    assert.equal((await post(base, "/api/validate", { input: { kind: "text", markdown: architect } })).status, 200);
  }));

test("server: with a cap, live providers without a price are refused and the mock still runs", () =>
  withStudio({ NOEMI_DAILY_SPEND_CAP_USD: "5" }, async ({ base }) =>
    withEnv({ AI_GW_API_KEY: "sk-test-key", GEMINI_MODEL: "gemini-unpriced", XAI_MODEL: "grok-unpriced" }, async () => {
      const bp = await saveBlueprint(base);
      const { text } = await arena(base, bp.id);
      const events = text.split("\n\n").filter(Boolean).map((b) => JSON.parse(b.slice(6)));
      assert.deepEqual(events.filter((e) => e.type === "done").map((e) => e.provider), ["mock"]);
      const failed = events.filter((e) => e.type === "failed");
      assert.deepEqual(failed.map((e) => e.provider).sort(), ["gemini", "xai"]);
      assert.ok(failed.every((e) => e.errors[0].code === "PROVIDER_CONFIG"));
    })));

test("server: the cost of a priced Arena answer is added to today's spend", () =>
  withLocalGateway((req, res) => {
    // Gemini-native streaming surface.
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1000000, candidatesTokenCount: 500000 } })}\n\n`);
  }, ({ base: gw }) =>
    withStudio({ NOEMI_DAILY_SPEND_CAP_USD: "100" }, async ({ base, dataDir }) =>
      withEnv({
        NOEMI_PRICE_TABLE: '{"gemini-test":{"inputPerMTok":2,"outputPerMTok":4},"grok-test":{"inputPerMTok":1,"outputPerMTok":1}}',
        AI_GW_API_KEY: "sk-test-key", AI_GW_BASE_URL: gw, AI_GW_MAX_RETRIES: "0", GEMINI_MODEL: "gemini-test", XAI_MODEL: "grok-test" }, async () => {
        const bp = await saveBlueprint(base);
        const { text } = await arena(base, bp.id);
        const done = text.split("\n\n").filter(Boolean).map((b) => JSON.parse(b.slice(6))).find((e) => e.type === "done" && e.provider === "gemini");
        assert.equal(done.usage.costUsd, 4, "1M in * $2 + 0.5M out * $4");

        const board = await (await fetch(`${base}/api/arena/scoreboard`)).json();
        assert.equal(board.find((r) => r.provider === "gemini").costUsd, 4);
        assert.equal(await createSpendLedger({ dir: dataDir }).spentToday(), 4);
      }))));

test("server: /api/run and /api/arena are throttled with Retry-After; other routes are not", () =>
  withStudio({ NOEMI_THROTTLE_MAX_REQUESTS: "2", NOEMI_THROTTLE_WINDOW_MS: "60000" }, async ({ base }) => {
    const bp = await saveBlueprint(base);
    const body = { input: { kind: "text", markdown: architect }, provider: "mock" };
    assert.equal((await post(base, "/api/run", body)).status, 200);
    assert.equal((await arena(base, bp.id)).res.status, 200);

    const limited = await post(base, "/api/run", body);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) >= 1);
    assert.equal((await arena(base, bp.id)).res.status, 429);

    assert.equal((await fetch(`${base}/api/runs`)).status, 200);
    assert.equal((await post(base, "/api/validate", { input: body.input })).status, 200);
  }));

test("config: cap, timezone, throttle and price settings are validated at startup", () => {
  const ok = { NOEMI_HTTP_ALLOWED_HOSTS: "127.0.0.1", NOEMI_STUDIO_TOKEN: STUDIO_TOKEN };
  const defaults = loadServerConfig(ok);
  assert.deepEqual([defaults.dailyCapUsd, defaults.spendTimeZone, defaults.throttle], [null, "UTC", { max: 30, windowMs: 60000 }]);
  assert.equal(loadServerConfig({ ...ok, NOEMI_THROTTLE_MAX_REQUESTS: "0" }).throttle, null);
  assert.equal(loadServerConfig({ ...ok, NOEMI_DAILY_SPEND_CAP_USD: "2.5" }).dailyCapUsd, 2.5);

  for (const bad of [
    { NOEMI_DAILY_SPEND_CAP_USD: "0" }, { NOEMI_DAILY_SPEND_CAP_USD: "-1" }, { NOEMI_DAILY_SPEND_CAP_USD: "abc" },
    { NOEMI_SPEND_TIMEZONE: "Mars/Base" }, { NOEMI_THROTTLE_MAX_REQUESTS: "-1" }, { NOEMI_THROTTLE_MAX_REQUESTS: "1.5" },
    { NOEMI_THROTTLE_WINDOW_MS: "0" }, { NOEMI_PRICE_TABLE: "nope" },
  ]) {
    assert.throws(() => loadServerConfig({ ...ok, ...bad }), (e) => e.code === "SERVER_CONFIG", JSON.stringify(bad));
  }
});
