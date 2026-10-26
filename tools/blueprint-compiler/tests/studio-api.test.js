import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { mkdtemp, readdir, rm } from "node:fs/promises";
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
const clean = {
  NOEMI_PREFERRED_PROVIDER: undefined, NOEMI_FALLBACK_PROVIDERS: undefined, NOEMI_RUNTIME: undefined,
  AI_GW_API_KEY: undefined, AI_GW_BASE_URL: undefined, AI_GW_MAX_RETRIES: undefined,
};
const ID = /^[a-f0-9]{24}$/;

async function withStudio(extra, fn) {
  const dataDir = await mkdtemp(join(tmpdir(), "studio-api-"));
  const lines = [];
  const server = createServer({
    env: { NOEMI_HTTP_ALLOWED_HOSTS: "127.0.0.1", NOEMI_STUDIO_DATA_DIR: dataDir, ...extra },
    repoRoot: fixtures,
    audit: { write: (s) => lines.push(s) },
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await withEnv(clean, () => fn({ base, dataDir, rawAudit: () => lines.join("") }));
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await rm(dataDir, { recursive: true, force: true });
  }
}

const send = (base, method, path, body) =>
  fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const getJson = async (promise) => (await promise).json();
const runIt = async (base, body) => (await send(base, "POST", "/api/run", body)).text();
const save = (base, name = "Architect", markdown = architect) =>
  getJson(send(base, "POST", "/api/blueprints", { name, markdown }));

test("blueprints: save, open, rename, replace and delete over HTTP", () =>
  withStudio({}, async ({ base, dataDir, rawAudit }) => {
    const created = await send(base, "POST", "/api/blueprints", { name: "  Architect v1 ", markdown: architect });
    assert.equal(created.status, 201);
    const bp = await created.json();
    assert.match(bp.id, ID);
    assert.equal(bp.name, "Architect v1");

    const list = await getJson(send(base, "GET", "/api/blueprints"));
    assert.deepEqual(list.map((b) => [b.id, b.name]), [[bp.id, "Architect v1"]]);
    assert.equal(list[0].markdown, undefined, "the table list carries no Markdown");

    const opened = await getJson(send(base, "GET", `/api/blueprints/${bp.id}`));
    assert.equal(opened.markdown, architect);

    const renamed = await getJson(send(base, "PATCH", `/api/blueprints/${bp.id}`, { name: "Architect v2" }));
    assert.deepEqual([renamed.name, renamed.markdown], ["Architect v2", architect]);

    const replaced = await getJson(send(base, "PUT", `/api/blueprints/${bp.id}`, { name: "Architect v3", markdown: "# edited" }));
    assert.deepEqual([replaced.name, replaced.markdown], ["Architect v3", "# edited"]);

    const del = await send(base, "DELETE", `/api/blueprints/${bp.id}`);
    assert.equal(del.status, 204);
    assert.equal(await del.text(), "");
    assert.equal((await send(base, "GET", `/api/blueprints/${bp.id}`)).status, 404);
    assert.equal((await send(base, "DELETE", `/api/blueprints/${bp.id}`)).status, 404);
    assert.deepEqual(await getJson(send(base, "GET", "/api/blueprints")), []);

    assert.ok((await readdir(dataDir)).every((n) => /^[a-f0-9]{24}\.json$/.test(n) || n === "runs.jsonl"));
    const audit = rawAudit();
    assert.ok(audit.includes("studio:blueprints.rename") && audit.includes("studio:blueprints.delete"));
    assert.ok(!audit.includes("Architect v3") && !audit.includes("# edited"), "names and Markdown never reach the audit record");
  }));

test("blueprints: a hostile name is stored as text and never becomes a path", () =>
  withStudio({}, async ({ base, dataDir }) => {
    const bp = await save(base, "../../etc/passwd");
    assert.equal(bp.name, "../../etc/passwd");
    assert.deepEqual(await readdir(dataDir), [`${bp.id}.json`]);
  }));

test("blueprints: ids that are not ours are 404 for every verb", () =>
  withStudio({}, async ({ base }) => {
    for (const id of ["not-an-id", "..%2F..%2Fetc%2Fpasswd", "%2e%2e", "ABCDEF0123456789ABCDEF01", `${"a".repeat(24)}.json`, "a".repeat(25)]) {
      for (const [method, body] of [["GET"], ["DELETE"], ["PATCH", { name: "n" }], ["PUT", { name: "n", markdown: "x" }]]) {
        const res = await send(base, method, `/api/blueprints/${id}`, body);
        assert.equal(res.status, 404, `${method} ${id}`);
        assert.equal((await res.json()).ok, false);
      }
    }
  }));

test("blueprints: malformed bodies are refused with 4xx and change nothing", () =>
  withStudio({ NOEMI_LOADER_MAX_BYTES: "100" }, async ({ base }) => {
    const bp = await save(base, "keep", "# keep");
    const cases = [
      ["POST", "/api/blueprints", { name: "", markdown: "x" }, 400],
      ["POST", "/api/blueprints", { name: "x".repeat(101), markdown: "x" }, 400],
      ["POST", "/api/blueprints", { name: "a\nb", markdown: "x" }, 400],
      ["POST", "/api/blueprints", { name: "n", markdown: 5 }, 400],
      ["POST", "/api/blueprints", { name: "n", markdown: "x".repeat(101) }, 413],
      ["POST", "/api/blueprints", ["not", "an", "object"], 400],
      ["PUT", `/api/blueprints/${bp.id}`, { name: "n" }, 400],
      ["PUT", `/api/blueprints/${bp.id}`, { markdown: "x" }, 400],
      ["PATCH", `/api/blueprints/${bp.id}`, {}, 400],
      ["PATCH", `/api/blueprints/${bp.id}`, { name: "  " }, 400],
    ];
    for (const [method, path, body, status] of cases) {
      const res = await send(base, method, path, body);
      assert.equal(res.status, status, `${method} ${path} ${JSON.stringify(body).slice(0, 40)}`);
      const out = await res.json();
      assert.equal(out.ok, false);
      assert.equal(typeof out.message, "string");
    }
    const after = await getJson(send(base, "GET", `/api/blueprints/${bp.id}`));
    assert.deepEqual([after.name, after.markdown], ["keep", "# keep"]);
  }));

test("blueprints: the configured limit is a 409", () =>
  withStudio({ NOEMI_STUDIO_MAX_BLUEPRINTS: "2" }, async ({ base }) => {
    await save(base, "one");
    await save(base, "two");
    assert.equal((await send(base, "POST", "/api/blueprints", { name: "three", markdown: "x" })).status, 409);
  }));

test("server: refuses to start with a bad store limit", () => {
  for (const extra of [{ NOEMI_STUDIO_MAX_BLUEPRINTS: "0" }, { NOEMI_STUDIO_MAX_RUNS: "many" }]) {
    assert.throws(() => createServer({ env: { NOEMI_HTTP_ALLOWED_HOSTS: "example.com", ...extra } }), { code: "SERVER_CONFIG" });
  }
});

test("history: runs are recorded with provider, timing, tokens and outcome, and nothing private", () =>
  withStudio({}, async ({ base, rawAudit }) => {
    const bp = await save(base);
    await runIt(base, { input: { kind: "text", markdown: architect }, prompt: "secret prompt text", provider: "mock", runtime: "direct", blueprintId: bp.id });
    await runIt(base, { input: { kind: "text", markdown: broken }, provider: "mock" });
    await send(base, "POST", "/api/validate", { input: { kind: "text", markdown: architect } });

    const runs = await getJson(send(base, "GET", "/api/runs"));
    assert.equal(runs.length, 2, "validate is not a run");
    const [bad, good] = runs; // newest first

    assert.equal(good.outcome, "ok");
    assert.deepEqual([good.provider, good.runtime, good.model], ["mock", "direct", "mock-hello-world"]);
    assert.deepEqual([good.blueprint, good.blueprintId], ["coding/architect", bp.id]);
    assert.ok(Number.isInteger(good.durationMs) && good.durationMs >= 0);
    assert.ok(Number.isInteger(good.inputTokens) && Number.isInteger(good.outputTokens));
    assert.deepEqual(good.fallbacks, []);
    assert.ok(!Number.isNaN(Date.parse(good.at)));

    assert.equal(bad.outcome, "error");
    assert.equal(bad.stage, "validate");
    assert.ok(bad.errorCodes.includes("MISSING_REFUSAL"));
    assert.match(bad.blueprint, /^text:\d+B$/);

    const text = JSON.stringify(runs);
    assert.ok(!text.includes("secret prompt text") && !text.includes("Senior Developer"), "no prompt, no persona text");
    assert.ok(!rawAudit().includes("secret prompt text"));

    assert.equal((await getJson(send(base, "GET", "/api/runs?limit=1"))).length, 1);
    for (const limit of ["0", "x", "501", "1.5"]) {
      assert.equal((await send(base, "GET", `/api/runs?limit=${limit}`)).status, 400, limit);
    }
  }));

test("history: a record exists by the time the stream's closing event arrives", () =>
  withStudio({}, async ({ base }) => {
    const res = await send(base, "POST", "/api/run", { input: { kind: "text", markdown: architect }, provider: "mock" });
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let seen = "";
    while (!seen.includes('"type":"done"')) {
      const { value, done } = await reader.read();
      assert.ok(!done, "stream ended before done");
      seen += value;
    }
    assert.equal((await getJson(send(base, "GET", "/api/runs"))).length, 1);
    await reader.cancel();
  }));

test("history: a fallback is its own outcome, and tokens come from the answering provider", async () => {
  const gateway = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => { res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); });
  });
  await new Promise((r) => gateway.listen(0, "127.0.0.1", r));
  try {
    await withStudio({}, async ({ base }) => {
      await withEnv({ AI_GW_API_KEY: "k", AI_GW_BASE_URL: `http://127.0.0.1:${gateway.address().port}`, AI_GW_MAX_RETRIES: "0", NOEMI_FALLBACK_PROVIDERS: "mock" }, async () => {
        await runIt(base, { input: { kind: "text", markdown: architect }, provider: "xai" });
      });
      const [r] = await getJson(send(base, "GET", "/api/runs"));
      assert.equal(r.outcome, "fallback");
      assert.equal(r.provider, "mock");
      assert.deepEqual(r.fallbacks, [{ provider: "xai", reason: "HTTP 503" }]);
    });
  } finally {
    gateway.closeAllConnections();
    await new Promise((r) => gateway.close(r));
  }
});

test("history: a failed provider run is an error row with codes only", () =>
  withStudio({}, async ({ base }) => {
    await runIt(base, { input: { kind: "text", markdown: architect }, provider: "xai" }); // no key set
    const [r] = await getJson(send(base, "GET", "/api/runs"));
    assert.deepEqual([r.outcome, r.stage, r.provider, r.errorCodes], ["error", "provider", "xai", ["PROVIDER_CONFIG"]]);
    assert.ok(!JSON.stringify(r).includes("AI_GW_API_KEY"), "no message text");
  }));

test("history: bad blueprintId is rejected and nothing is recorded; the cap keeps the newest", () =>
  withStudio({ NOEMI_STUDIO_MAX_RUNS: "2" }, async ({ base }) => {
    const res = await send(base, "POST", "/api/run", { input: { kind: "text", markdown: architect }, blueprintId: "../x" });
    assert.equal(res.status, 400);
    assert.deepEqual(await getJson(send(base, "GET", "/api/runs")), []);

    for (const prompt of ["one", "two", "three"]) await runIt(base, { input: { kind: "text", markdown: architect }, prompt, provider: "mock" });
    assert.equal((await getJson(send(base, "GET", "/api/runs"))).length, 2);
  }));

test("history: an unwritable data folder never breaks a run", async () => {
  await withStudio({}, async ({ base, dataDir }) => {
    await rm(dataDir, { recursive: true, force: true });
    await (await import("node:fs/promises")).writeFile(dataDir, "a file where the folder should be");
    const raw = await runIt(base, { input: { kind: "text", markdown: architect }, provider: "mock" });
    assert.ok(raw.includes('"type":"done"'));
  });
});