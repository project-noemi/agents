import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileRegistry, compileUrl } from "../src/compile.js";
import { DEFAULT_REGISTRY_URL, loadLoaderConfig } from "../src/config.js";
import { loadHttp } from "../src/loaders/http.js";
import { loadRegistry, parseRegistryRef, registryUrl } from "../src/loaders/registry.js";
import { persona } from "./helpers/persona.js";
import { recordFetch, textResponse, withEnv, withFetch } from "./helpers/fake-network.js";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(pkg, "fixtures");
const architect = readFileSync(join(fixtures, "architect.core.md"), "utf8");
const clean = { NOEMI_PREFERRED_PROVIDER: undefined, NOEMI_FALLBACK_PROVIDERS: undefined, NOEMI_REPO_ROOT: undefined,
  NOEMI_HTTP_ALLOWED_HOSTS: undefined, NOEMI_LOADER_TIMEOUT_MS: undefined, NOEMI_LOADER_MAX_BYTES: undefined,
  NOEMI_REGISTRY_URL: undefined, NOEMI_REGISTRY_VERSION: undefined };

const URL_OK = "https://example.test/agents/coding/architect/core.md";
const neverFetch = () => { throw new Error("fetch must not be called"); };
const rejectsLoad = (p, pattern) => assert.rejects(p, (e) => e.code === "LOAD" && pattern.test(e.message), String(pattern));

// ------------------------------------------------------------------ config

test("loader config: defaults", () => {
  const c = loadLoaderConfig({});
  assert.deepEqual(c, {
    allowedHosts: [], timeoutMs: 10_000, maxBytes: 262_144,
    registry: { baseUrl: DEFAULT_REGISTRY_URL, defaultVersion: "main" },
  });
});

test("loader config: reads env, lowercases and trims hosts, empty means unset", () => {
  const c = loadLoaderConfig({
    NOEMI_HTTP_ALLOWED_HOSTS: " Raw.GitHubUserContent.com , ,example.test ", NOEMI_LOADER_TIMEOUT_MS: "500",
    NOEMI_LOADER_MAX_BYTES: " 2048 ", NOEMI_REGISTRY_URL: " https://reg.test/x ", NOEMI_REGISTRY_VERSION: "2026.09.11",
  });
  assert.deepEqual(c.allowedHosts, ["raw.githubusercontent.com", "example.test"]);
  assert.deepEqual([c.timeoutMs, c.maxBytes], [500, 2048]);
  assert.deepEqual(c.registry, { baseUrl: "https://reg.test/x", defaultVersion: "2026.09.11" });
  assert.equal(loadLoaderConfig({ NOEMI_REGISTRY_URL: "", NOEMI_REGISTRY_VERSION: " " }).registry.defaultVersion, "main");
});

test("loader config: a bad number is a LOAD_CONFIG error, not a silent default", () => {
  for (const v of ["abc", "0", "-1", "1.5"]) {
    assert.throws(() => loadLoaderConfig({ NOEMI_LOADER_TIMEOUT_MS: v }), (e) => e.code === "LOAD_CONFIG" && /NOEMI_LOADER_TIMEOUT_MS/.test(e.message));
    assert.throws(() => loadLoaderConfig({ NOEMI_LOADER_MAX_BYTES: v }), (e) => e.code === "LOAD_CONFIG");
  }
});

test("loader config is read at call time", async () => {
  await withEnv({ NOEMI_REGISTRY_VERSION: "v9" }, async () => assert.equal(loadLoaderConfig().registry.defaultVersion, "v9"));
});

// -------------------------------------------------------------- http loader

test("http: returns markdown and an http source with the normalized URL", async () => {
  const fake = recordFetch(async () => textResponse(architect));
  await withFetch(fake, async () => {
    const r = await loadHttp(URL_OK);
    assert.equal(r.markdown, architect);
    assert.deepEqual(r.source, { kind: "http", ref: URL_OK });
  });
  const { url, init } = fake.calls[0];
  assert.equal(url, URL_OK);
  assert.equal(init.redirect, "manual", "redirects are never followed");
  assert.ok(init.signal instanceof AbortSignal);
});

test("http: URLs that could leak or redirect a request are refused before any fetch", async () => {
  await withFetch(neverFetch, async () => {
    const bad = [
      ["not a url", /not a valid URL/], ["ftp://example.test/a.md", /https/], ["file:///etc/passwd", /https/],
      ["http://example.test/a.md", /https/], ["http://localhost.evil.test/a.md", /https/],
      ["https://user:pw@example.test/a.md", /credentials/], ["https://example.test/a.md?token=s3cret", /query/],
      ["https://example.test/a.md#frag", /fragment/],
    ];
    for (const [url, pattern] of bad) await rejectsLoad(loadHttp(url), pattern);
  });
});

test("http: an error message never contains a would-be secret from the URL", async () => {
  await withFetch(neverFetch, async () => {
    await assert.rejects(loadHttp("https://user:s3cret@example.test/a.md?k=s3cret"), (e) => !e.message.includes("s3cret"));
  });
});

test("http: plain http is allowed for localhost only", async () => {
  await withFetch(async () => textResponse("# x"), async () => {
    assert.equal((await loadHttp("http://localhost:8787/a.md")).markdown, "# x");
    assert.equal((await loadHttp("http://127.0.0.1:8787/a.md")).markdown, "# x");
  });
});

test("http: the host allowlist is enforced case-insensitively, before any fetch", async () => {
  await withFetch(neverFetch, () => rejectsLoad(loadHttp(URL_OK, { allowedHosts: ["other.test"] }), /not in the allowed host list/));
  await withFetch(async () => textResponse("# x"), async () => {
    assert.equal((await loadHttp("https://EXAMPLE.test/a.md", { allowedHosts: ["example.test"] })).markdown, "# x");
  });
});

test("http: redirects, HTTP errors, and HTML pages fail closed", async () => {
  const cases = [
    [() => textResponse("", { status: 302, headers: { location: "http://169.254.169.254/" } }), /redirect/],
    [() => textResponse("", { status: 301 }), /redirect/],
    [() => textResponse("nope", { status: 404 }), /HTTP 404/],
    [() => textResponse("boom", { status: 500 }), /HTTP 500/],
    [() => textResponse("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } }), /HTML/],
  ];
  for (const [make, pattern] of cases) {
    await withFetch(async () => make(), () => rejectsLoad(loadHttp(URL_OK), pattern));
  }
});

test("http: a missing content-type is accepted", async () => {
  await withFetch(async () => textResponse("# x", { headers: {} }), async () => {
    assert.equal((await loadHttp(URL_OK)).markdown, "# x");
  });
});

test("http: the size cap holds for a declared length, a streamed body, and exactly at the limit", async () => {
  await withFetch(async () => textResponse("x", { headers: { "content-length": "999999", "content-type": "text/plain" } }),
    () => rejectsLoad(loadHttp(URL_OK, { maxBytes: 100 }), /larger than the 100-byte limit/));
  await withFetch(async () => textResponse("x".repeat(500)),
    () => rejectsLoad(loadHttp(URL_OK, { maxBytes: 100 }), /larger than the 100-byte limit/));
  await withFetch(async () => textResponse("x".repeat(100)), async () => {
    assert.equal((await loadHttp(URL_OK, { maxBytes: 100 })).markdown.length, 100);
  });
});

test("http: the cap counts bytes, not characters", async () => {
  await withFetch(async () => textResponse("é".repeat(60)),   // 120 bytes
    () => rejectsLoad(loadHttp(URL_OK, { maxBytes: 100 }), /limit/));
});

test("http: a timeout and a network failure are structured LOAD errors", async () => {
  await withFetch(async () => { throw new DOMException("t", "TimeoutError"); }, () => rejectsLoad(loadHttp(URL_OK, { timeoutMs: 50 }), /timed out after 50 ms/));
  await withFetch(async () => { throw new TypeError("fetch failed"); }, () => rejectsLoad(loadHttp(URL_OK), /network error/));
});

test("http: a body that stalls mid-stream hits the timeout too", async () => {
  await withFetch(async (_u, { signal }) => {
    const hold = setTimeout(() => {}, 5_000);   // AbortSignal.timeout() is unref'd; a socket would hold the loop
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("# par"));
        signal.addEventListener("abort", () => { clearTimeout(hold); c.error(new DOMException("t", "TimeoutError")); });
      },
    });
    return new Response(body, { headers: { "content-type": "text/plain" } });
  }, () => rejectsLoad(loadHttp(URL_OK, { timeoutMs: 30 }), /timed out/));
});

// ---------------------------------------------------------- registry loader

test("registry: refs parse with and without a version", () => {
  assert.deepEqual(parseRegistryRef("coding/architect"), { ref: "coding/architect" });
  assert.deepEqual(parseRegistryRef(" coding/architect@2026.09.11 "), { ref: "coding/architect", version: "2026.09.11" });
  assert.deepEqual(parseRegistryRef("coding/architect@v1.2.0-rc1"), { ref: "coding/architect", version: "v1.2.0-rc1" });
});

test("registry: anything that could add a segment, query, or host is refused", () => {
  const bad = ["", "architect", "a/b/c", "../x", "coding/../x", "Coding/architect", "coding/Arch", "coding\\architect",
    "/coding/architect", "coding/architect/", "coding/architect@", "coding/architect@../x", "coding/architect@v/1",
    "coding/architect@v1?x=1", "coding/architect@v1#f", "coding/architect@.hidden", "coding/architect@a b",
    "coding/architect\n@v1", `coding/${"a".repeat(65)}`, "coding/architect@" + "v".repeat(65), "https://evil.test/x"];
  for (const input of bad) {
    assert.throws(() => parseRegistryRef(input), (e) => e.code === "LOAD", JSON.stringify(input));
  }
});

test("registry: the URL layout is {base}/{version}/agents/{domain}/{name}/core.md", () => {
  const cfg = { baseUrl: "https://reg.test/root//", defaultVersion: "main" };
  assert.equal(registryUrl({ ref: "coding/architect" }, cfg), "https://reg.test/root/main/agents/coding/architect/core.md");
  assert.equal(registryUrl({ ref: "coding/architect", version: "2026.09.11" }, cfg), "https://reg.test/root/2026.09.11/agents/coding/architect/core.md");
});

test("registry: loads through the http loader and records a registry source with the resolved version", async () => {
  const fake = recordFetch(async () => textResponse(architect));
  const opts = { registry: { baseUrl: DEFAULT_REGISTRY_URL, defaultVersion: "main" } };
  await withFetch(fake, async () => {
    const pinned = await loadRegistry("coding/architect@2026.09.11", opts);
    assert.deepEqual(pinned.source, { kind: "registry", ref: "coding/architect", version: "2026.09.11" });
    const floating = await loadRegistry("coding/architect", opts);
    assert.deepEqual(floating.source, { kind: "registry", ref: "coding/architect", version: "main" });
    assert.equal(floating.markdown, architect);
  });
  assert.equal(fake.calls[0].url, "https://raw.githubusercontent.com/project-noemi/agents/2026.09.11/agents/coding/architect/core.md");
});

test("registry: it inherits the http rules (https, allowlist, size cap, no redirects)", async () => {
  const reg = (baseUrl) => ({ registry: { baseUrl, defaultVersion: "main" } });
  await withFetch(neverFetch, async () => {
    await rejectsLoad(loadRegistry("coding/architect", reg("http://reg.test")), /https/);
    await rejectsLoad(loadRegistry("coding/architect", { ...reg("https://reg.test"), allowedHosts: ["other.test"] }), /allowed host/);
    await rejectsLoad(loadRegistry("../x", reg("https://reg.test")), /not a lowercase-hyphen/);
  });
  await withFetch(async () => textResponse("", { status: 302 }), () => rejectsLoad(loadRegistry("coding/architect", reg("https://reg.test")), /redirect/));
  await withFetch(async () => textResponse("x".repeat(500)), () =>
    rejectsLoad(loadRegistry("coding/architect", { ...reg("https://reg.test"), maxBytes: 100 }), /limit/));
});

// --------------------------------------- the same validate/resolve path as files

const viaUrl = (md, opts = {}) => withFetch(async () => textResponse(md), () => withEnv(clean, () =>
  compileUrl(URL_OK, { provider: "mock", repoRoot: fixtures, ...opts })));

test("compileUrl: a valid persona compiles and keeps its http source", async () => {
  const r = await viaUrl(architect);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ir.source, { kind: "http", ref: URL_OK });
  assert.equal(r.ir.id, "coding/architect");
  assert.deepEqual(r.resolved.skills.map((s) => s.path), ["skills/verification/pre-flight-check.md"]);
  assert.equal(r.run.provider, "mock");
});

test("compileUrl: validate still fails closed on a persona with no Refusal Criteria", async () => {
  const r = await viaUrl(persona({ rules: "1. Be safe." }));
  assert.equal(r.ok, false);
  assert.equal(r.stage, "validate");
  assert.deepEqual(r.errors.map((e) => e.code), ["MISSING_REFUSAL"]);
});

test("compileUrl: resolve still reports every bad ref, so a remote persona cannot reach outside skills/", async () => {
  const r = await viaUrl(readFileSync(join(fixtures, "traversal.core.md"), "utf8"));
  assert.equal(r.stage, "resolve");
  assert.equal(r.errors.length, 6);
  assert.ok(r.errors.every((e) => e.code === "BAD_SLUG"));
  const bad = await viaUrl(readFileSync(join(fixtures, "bad-skill.core.md"), "utf8"));
  assert.deepEqual(bad.errors.map((e) => e.code), ["UNRESOLVED_SKILL", "UNRESOLVED_MCP"]);
});

test("compileUrl: a load failure is structured with stage load, and the url as path", async () => {
  const r = await withFetch(async () => textResponse("", { status: 404 }), () => withEnv(clean, () => compileUrl(URL_OK, { provider: "mock" })));
  assert.equal(r.ok, false);
  assert.equal(r.stage, "load");
  assert.deepEqual([r.errors[0].code, r.errors[0].path], ["LOAD", URL_OK]);
});

test("compileUrl: env settings apply, and a bad one is a structured LOAD_CONFIG failure", async () => {
  await withFetch(neverFetch, async () => {
    const blocked = await withEnv({ ...clean, NOEMI_HTTP_ALLOWED_HOSTS: "other.test" }, () => compileUrl(URL_OK, { provider: "mock" }));
    assert.equal(blocked.stage, "load");
    assert.match(blocked.errors[0].message, /allowed host/);
    const badCfg = await withEnv({ ...clean, NOEMI_LOADER_TIMEOUT_MS: "soon" }, () => compileUrl(URL_OK, { provider: "mock" }));
    assert.deepEqual([badCfg.stage, badCfg.errors[0].code], ["load", "LOAD_CONFIG"]);
  });
});

test("compileUrl: opts.loader beats the environment", async () => {
  const r = await withFetch(async () => textResponse(architect), () =>
    withEnv({ ...clean, NOEMI_HTTP_ALLOWED_HOSTS: "other.test" }, () =>
      compileUrl(URL_OK, { provider: "mock", repoRoot: fixtures, loader: { allowedHosts: [] } })));
  assert.equal(r.ok, true);
});

test("compileRegistry: compiles by ref, records the registry source, and validates the same way", async () => {
  const fake = recordFetch(async () => textResponse(architect));
  const run = (ref) => withFetch(fake, () => withEnv(clean, () => compileRegistry(ref, { provider: "mock", repoRoot: fixtures })));
  const r = await run("coding/architect@2026.09.11");
  assert.equal(r.ok, true);
  assert.deepEqual(r.ir.source, { kind: "registry", ref: "coding/architect", version: "2026.09.11" });
  assert.equal(fake.calls[0].url, `${DEFAULT_REGISTRY_URL}/2026.09.11/agents/coding/architect/core.md`);
  const bad = await run("../x");
  assert.deepEqual([bad.stage, bad.errors[0].code], ["load", "LOAD"]);
  assert.equal(fake.calls.length, 1, "a bad ref never reaches the network");
  const noRefusal = await withFetch(async () => textResponse(persona({ rules: "x" })), () => withEnv(clean, () =>
    compileRegistry("coding/architect", { provider: "mock", repoRoot: fixtures })));
  assert.equal(noRefusal.stage, "validate");
});

test("compileRegistry: NOEMI_REGISTRY_URL and NOEMI_REGISTRY_VERSION are honored", async () => {
  const fake = recordFetch(async () => textResponse(architect));
  await withFetch(fake, () => withEnv({ ...clean, NOEMI_REGISTRY_URL: "https://reg.test/base", NOEMI_REGISTRY_VERSION: "v2" }, () =>
    compileRegistry("coding/architect", { provider: "mock", repoRoot: fixtures })));
  assert.equal(fake.calls[0].url, "https://reg.test/base/v2/agents/coding/architect/core.md");
});

// ------------------------------------------------------------------- the CLI

const runCli = (args, env = {}) => new Promise((resolve) =>
  execFile(process.execPath, [join(pkg, "src", "cli.js"), ...args],
    { cwd: pkg, env: { ...process.env, NOEMI_PREFERRED_PROVIDER: "", NOEMI_FALLBACK_PROVIDERS: "", NOEMI_REPO_ROOT: fixtures, ...env } },
    (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })));

async function withServer(routes, fn) {
  const server = http.createServer((req, res) => {
    const body = routes[req.url];
    res.statusCode = body === undefined ? 404 : 200;
    res.setHeader("content-type", "text/markdown");
    res.end(body ?? "not found");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); }
}

test("cli: compile <url> runs the same pipeline and writes one audit line", async () => {
  await withServer({ "/core.md": architect }, async (base) => {
    const r = await runCli(["compile", `${base}/core.md`, "--provider", "mock"]);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.ir.source.kind, "http");
    assert.deepEqual(out.resolved.skills.map((s) => s.path), ["skills/verification/pre-flight-check.md"]);
    assert.equal(r.stderr.trim().split("\n").length, 1);
    assert.equal(JSON.parse(r.stderr).result, "ok");
  });
});

test("cli: compile registry:<ref>@<version> reads NOEMI_REGISTRY_URL", async () => {
  await withServer({ "/v1/agents/coding/architect/core.md": architect }, async (base) => {
    const r = await runCli(["compile", "registry:coding/architect@v1", "--provider", "mock"], { NOEMI_REGISTRY_URL: base });
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout).ir.source, { kind: "registry", ref: "coding/architect", version: "v1" });
  });
});

test("cli: a failed remote load exits 1 with a LOAD audit record, not a stack trace", async () => {
  await withServer({}, async (base) => {
    const r = await runCli(["compile", `${base}/missing.md`, "--provider", "mock"]);
    assert.equal(r.code, 1);
    assert.match(JSON.parse(r.stderr.split("\n")[0]).result, /^error:LOAD$/);
    const bad = await runCli(["compile", "registry:../x", "--provider", "mock"]);
    assert.equal(bad.code, 1);
    assert.match(JSON.parse(bad.stderr.split("\n")[0]).result, /^error:LOAD$/);
  });
});

test("cli: --runtime mastra --provider xai runs end to end against a loopback gateway", async () => {
  const gw = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: "m",
        choices: [{ index: 0, message: { role: "assistant", content: "hello from mastra" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } }));
    });
  });
  await new Promise((r) => gw.listen(0, "127.0.0.1", r));
  try {
    const r = await runCli(
      ["compile", join(fixtures, "architect.core.md"), "--runtime", "mastra", "--provider", "xai"],
      { AI_GW_API_KEY: "sk-canary", AI_GW_BASE_URL: `http://127.0.0.1:${gw.address().port}` });
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.run.provider, "xai");
    assert.equal(out.run.runtime, "mastra");
    assert.equal(out.run.output, "hello from mastra");
    const audit = JSON.parse(r.stderr.trim());
    assert.deepEqual(audit.inputs.slice(1), ["xai", "mastra"]);
    assert.ok(audit.actions.includes("run:xai+mastra"));
    assert.equal(r.stderr.trim().split("\n").length, 1, "one audit line; Mastra's logger is silent");
    assert.ok(!r.stdout.includes("sk-canary") && !r.stderr.includes("sk-canary"));
  } finally {
    gw.closeAllConnections();
    await new Promise((r) => gw.close(r));
  }
});