import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "../src/server.js";
import { withEnv } from "./helpers/fake-network.js";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(pkg, "fixtures");
const architect = readFileSync(join(fixtures, "architect.core.md"), "utf8");
const broken = readFileSync(join(fixtures, "broken.missing-refusal.md"), "utf8");

const CANARY = "sk-test-canary-7f3a";
// Model selection is per request here; keep the host's own settings out of it.
const clean = {
  NOEMI_PREFERRED_PROVIDER: undefined, NOEMI_FALLBACK_PROVIDERS: undefined, NOEMI_RUNTIME: undefined,
  AI_GW_API_KEY: undefined, AI_GW_BASE_URL: undefined,
};

async function listen(server) {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}

// A loopback stand-in for a persona host: path -> [status, body, headers].
async function withPersonaHost(routes, fn) {
  const host = http.createServer((req, res) => {
    const [status, body, headers = { "content-type": "text/markdown" }] = routes[req.url] ?? [404, "not found"];
    res.writeHead(status, headers);
    res.end(body);
  });
  const base = await listen(host);
  try { return await fn(base); } finally { await close(host); }
}

/** Start the Studio server with `env`; fn gets { base, audit } where audit is every record written. */
async function withStudio(env, fn) {
  const lines = [];
  const server = createServer({
    env: { NOEMI_HTTP_ALLOWED_HOSTS: "127.0.0.1", ...env },
    repoRoot: fixtures,
    audit: { write: (s) => lines.push(s) },
  });
  const base = await listen(server);
  try {
    return await fn({ base, audit: () => lines.map((l) => JSON.parse(l)), rawAudit: () => lines.join("") });
  } finally { await close(server); }
}

const post = (base, path, body) => fetch(`${base}${path}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

/** POST /api/run and return the parsed SSE events plus the raw stream text. */
async function runEvents(base, body) {
  const res = await post(base, "/api/run", body);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/event-stream/);
  const raw = await res.text();
  const events = raw.split("\n\n").filter(Boolean).map((block) => {
    assert.match(block, /^data: /);
    return JSON.parse(block.slice("data: ".length));
  });
  return { events, raw };
}

test("server: refuses to start without NOEMI_HTTP_ALLOWED_HOSTS", () => {
  for (const value of [undefined, "", " , "]) {
    assert.throws(() => createServer({ env: { NOEMI_HTTP_ALLOWED_HOSTS: value } }), { code: "SERVER_CONFIG" });
  }
});

test("server: refuses to start with a bad port, body cap, or origin", () => {
  const base = { NOEMI_HTTP_ALLOWED_HOSTS: "example.com" };
  for (const extra of [{ NOEMI_STUDIO_PORT: "80a" }, { NOEMI_STUDIO_MAX_BODY_BYTES: "0" }, { NOEMI_STUDIO_ORIGIN: "not a url" }]) {
    assert.throws(() => createServer({ env: { ...base, ...extra } }), { code: "SERVER_CONFIG" });
  }
});

test("server: the npm script exits 1 with a message when the allowlist is unset", async () => {
  const { execFile } = await import("node:child_process");
  const r = await new Promise((resolve) => execFile(process.execPath, [join(pkg, "src/server.js")],
    { env: { ...process.env, NOEMI_HTTP_ALLOWED_HOSTS: "" } },
    (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stderr })));
  assert.equal(r.code, 1);
  assert.match(r.stderr, /NOEMI_HTTP_ALLOWED_HOSTS/);
});

test("server: health and providers list names only", async () => {
  await withEnv({ ...clean, AI_GW_API_KEY: CANARY }, () => withStudio({}, async ({ base, audit }) => {
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true });
    const body = await (await fetch(`${base}/api/providers`)).text();
    assert.deepEqual(JSON.parse(body), { providers: ["mock", "gemini", "xai"], runtimes: ["direct", "mastra"] });
    assert.ok(!body.includes(CANARY));
    assert.deepEqual(audit().map((r) => r.task), ["studio:health", "studio:providers"]);
  }));
});

test("server: validate accepts pasted text and fails closed on a missing refusal", async () => {
  await withEnv(clean, () => withStudio({}, async ({ base, audit }) => {
    const ok = await (await post(base, "/api/validate", { input: { kind: "text", markdown: architect } })).json();
    assert.equal(ok.ok, true);
    assert.equal(ok.ir.id, "coding/architect");
    assert.deepEqual(ok.resolved.skills.map((s) => s.path), ["skills/verification/pre-flight-check.md"]);
    assert.equal(ok.run, undefined, "validate must not run a provider");

    const bad = await (await post(base, "/api/validate", { input: { kind: "text", markdown: broken } })).json();
    assert.equal(bad.ok, false);
    assert.equal(bad.stage, "validate");
    assert.ok(bad.errors.some((e) => e.code === "MISSING_REFUSAL"));

    const [first, second] = audit();
    assert.equal(first.task, "studio:validate:coding/architect");
    assert.deepEqual(first.actions, ["parse", "validate", "resolve"]);
    assert.deepEqual(first.inputs, [`text:${Buffer.byteLength(architect)}B`]);
    assert.match(second.result, /^error:.*MISSING_REFUSAL/);
  }));
});

test("server: pasted text over the loader size cap is a load failure", async () => {
  await withEnv(clean, () => withStudio({ NOEMI_LOADER_MAX_BYTES: "100" }, async ({ base }) => {
    const r = await (await post(base, "/api/validate", { input: { kind: "text", markdown: architect } })).json();
    assert.equal(r.stage, "load");
    assert.equal(r.errors[0].code, "LOAD");
  }));
});

test("server: URLs load only from allowlisted hosts, without redirects", async () => {
  await withPersonaHost({
    "/core.md": [200, architect],
    "/moved.md": [302, "", { location: "http://169.254.169.254/" }],
  }, (host) => withEnv(clean, () => withStudio({}, async ({ base, audit, rawAudit }) => {
    const validate = async (url) => (await post(base, "/api/validate", { input: { kind: "url", url } })).json();

    const ok = await validate(`${host}/core.md`);
    assert.equal(ok.ok, true);
    assert.equal(ok.ir.source.kind, "http");

    for (const url of [
      "https://example.com/core.md",         // not on the allowlist; never fetched
      `${host}/moved.md`,                    // redirect
      "http://example.com/core.md",          // plain http off loopback
      `${host}/core.md?token=abc`,           // query string
    ]) {
      const r = await validate(url);
      assert.equal(r.stage, "load", url);
      assert.equal(r.errors[0].code, "LOAD", url);
    }

    // Audit keeps the host, never the path or query.
    assert.deepEqual(audit()[0].inputs, ["url:127.0.0.1"]);
    assert.ok(!rawAudit().includes("core.md"));
    assert.ok(!rawAudit().includes("token=abc"));
  })));
});

test("server: registry refs load through the allowlisted registry base", async () => {
  await withPersonaHost({ "/v1/agents/coding/architect/core.md": [200, architect] }, (host) =>
    withEnv(clean, () => withStudio({ NOEMI_REGISTRY_URL: host }, async ({ base, audit }) => {
      const ok = await (await post(base, "/api/validate", { input: { kind: "registry", ref: "coding/architect@v1" } })).json();
      assert.equal(ok.ok, true);
      assert.deepEqual(ok.ir.source, { kind: "registry", ref: "coding/architect", version: "v1" });

      const bad = await (await post(base, "/api/validate", { input: { kind: "registry", ref: "../etc/passwd" } })).json();
      assert.equal(bad.stage, "load");
      assert.deepEqual(audit().map((r) => r.inputs[0]), ["registry:coding/architect@v1", "registry:(invalid)"]);
    })));
});

test("server: a registry on a host outside the allowlist is refused", async () => {
  await withEnv(clean, () => withStudio({ NOEMI_REGISTRY_URL: "https://raw.githubusercontent.com/project-noemi/agents" }, async ({ base }) => {
    const r = await (await post(base, "/api/validate", { input: { kind: "registry", ref: "coding/architect" } })).json();
    assert.equal(r.stage, "load");
    assert.match(r.errors[0].message, /not in the allowed host list/);
  }));
});

test("server: run streams start, token, done with the mock provider", async () => {
  await withEnv(clean, () => withStudio({}, async ({ base, audit, rawAudit }) => {
    const prompt = "summarize the private notes of Jane Example";
    const { events } = await runEvents(base, {
      input: { kind: "text", markdown: architect }, prompt, provider: "mock", runtime: "direct",
    });
    assert.deepEqual(events.map((e) => e.type), ["start", "token", "done"]);
    assert.deepEqual(events[0], { type: "start", provider: "mock", runtime: "direct" });
    assert.match(events[1].text, /^\[mock\] compiled coding\/architect/);
    assert.match(events[1].text, /Jane Example/);
    assert.equal(events[2].provider, "mock");
    assert.deepEqual(events[2].fallbacks, []);

    const [record] = audit();
    assert.equal(record.task, "studio:run:coding/architect");
    assert.deepEqual(record.inputs, [`text:${Buffer.byteLength(architect)}B`, "mock", "direct"]);
    assert.deepEqual(record.actions, ["parse", "validate", "resolve", "run:mock"]);
    assert.ok(!rawAudit().includes("Jane"), "the prompt never reaches the audit record");
    assert.ok(!rawAudit().includes("Senior Developer"), "the persona text never reaches the audit record");
  }));
});

test("server: a failing persona streams one error event and no start", async () => {
  await withEnv(clean, () => withStudio({}, async ({ base }) => {
    const { events } = await runEvents(base, { input: { kind: "text", markdown: broken }, provider: "mock" });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "error");
    assert.equal(events[0].stage, "validate");
  }));
});

test("server: keys stay on the server through a live call and a fallback", async () => {
  const seen = [];
  const gateway = http.createServer((req, res) => {
    seen.push(req.headers.authorization);
    req.resume();
    req.on("end", () => { res.writeHead(503, { "content-type": "application/json" }); res.end(`{"error":"down","key":"${CANARY}"}`); });
  });
  const gw = await listen(gateway);
  try {
    await withEnv({ ...clean, AI_GW_API_KEY: CANARY, AI_GW_BASE_URL: gw, AI_GW_MAX_RETRIES: "0", NOEMI_FALLBACK_PROVIDERS: "mock" },
      () => withStudio({}, async ({ base, audit, rawAudit }) => {
        const { events, raw } = await runEvents(base, { input: { kind: "text", markdown: architect }, prompt: "hi", provider: "xai" });
        assert.equal(events[0].type, "start");
        assert.equal(events.at(-1).type, "done");
        assert.ok(events.slice(1, -1).every((e) => e.type === "token"));
        assert.deepEqual(events[0], { type: "start", provider: "xai", runtime: "direct" });
        assert.equal(events.at(-1).provider, "mock");
        assert.deepEqual(events.at(-1).fallbacks, [{ provider: "xai", reason: "HTTP 503" }]);
        assert.deepEqual(audit()[0].actions, ["parse", "validate", "resolve", "fallback-from:xai", "run:mock"]);

        assert.ok(seen.length > 0 && seen.every((h) => h === `Bearer ${CANARY}`), "the gateway got the key");
        assert.ok(!raw.includes(CANARY), "the stream never carries the key");
        assert.ok(!rawAudit().includes(CANARY), "the audit never carries the key");
      }));
  } finally { await close(gateway); }
});

test("server: a provider failure streams an error with codes, and the audit drops the message", async () => {
  await withEnv({ ...clean, AI_GW_API_KEY: undefined }, () => withStudio({}, async ({ base, audit }) => {
    const { events } = await runEvents(base, { input: { kind: "text", markdown: architect }, provider: "gemini" });
    assert.deepEqual(events.map((e) => e.type), ["error"]);
    assert.equal(events[0].stage, "provider");
    assert.deepEqual(audit()[0].risks, events[0].errors.map((e) => e.code));
  }));
});

test("server: rejects malformed requests before compiling", async () => {
  await withEnv(clean, () => withStudio({ NOEMI_STUDIO_MAX_BODY_BYTES: "20000" }, async ({ base, audit }) => {
    const json = { method: "POST", headers: { "content-type": "application/json" } };
    const cases = [
      [() => post(base, "/api/validate", { input: { kind: "file", ref: "/etc/passwd" } }), 400],
      [() => post(base, "/api/validate", { input: { kind: "url" } }), 400],
      [() => post(base, "/api/run", { input: { kind: "text", markdown: "x" }, provider: "openai" }), 400],
      [() => post(base, "/api/run", { input: { kind: "text", markdown: "x" }, runtime: "lambda" }), 400],
      [() => post(base, "/api/run", { input: { kind: "text", markdown: "x" }, prompt: "x".repeat(16_001) }), 400],
      [() => post(base, "/api/validate", { input: { kind: "text", markdown: "x".repeat(30_000) } }), 413],
      [() => fetch(`${base}/api/validate`, { ...json, headers: { "content-type": "text/plain" }, body: "{}" }), 415],
      [() => fetch(`${base}/api/validate`, { ...json, body: "{" }), 400],
      [() => fetch(`${base}/api/blueprints`), 404],
      [() => fetch(`${base}/api/secret-path-jane`), 404],
    ];
    for (const [send, status] of cases) {
      const res = await send();
      assert.equal(res.status, status);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.equal(typeof body.message, "string");
    }
    const records = audit();
    assert.equal(records.length, cases.length, "every request is audited");
    assert.ok(records.every((r) => r.result.startsWith("rejected:")));
    assert.ok(!JSON.stringify(records).includes("jane"), "unknown paths are not logged");
  }));
});

test("server: rejects a Host header it does not serve (DNS rebinding)", async () => {
  await withEnv(clean, () => withStudio({}, async ({ base }) => {
    const { port } = new URL(base);
    const status = await new Promise((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path: "/api/health", headers: { host: "attacker.example" } },
        (res) => { res.resume(); resolve(res.statusCode); }).on("error", reject);
    });
    assert.equal(status, 421);
  }));
});

test("server: CORS headers and preflight only for NOEMI_STUDIO_ORIGIN", async () => {
  await withEnv(clean, () => withStudio({}, async ({ base }) => {
    const res = await fetch(`${base}/api/health`, { headers: { origin: "http://localhost:5173" } });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  }));
  await withEnv(clean, () => withStudio({ NOEMI_STUDIO_ORIGIN: "http://localhost:5173" }, async ({ base }) => {
    const pre = await fetch(`${base}/api/run`, { method: "OPTIONS", headers: { origin: "http://localhost:5173" } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("access-control-allow-origin"), "http://localhost:5173");
    const other = await fetch(`${base}/api/run`, { method: "OPTIONS", headers: { origin: "https://evil.example" } });
    assert.equal(other.status, 404);
  }));
});
