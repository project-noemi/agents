import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBlueprintStore, ID } from "../src/store/blueprints.js";
import { createRunStore, runRecordFrom } from "../src/store/runs.js";

// Offline: every test works in its own temp folder and touches nothing else.
async function folder(t) {
  const root = await mkdtemp(join(tmpdir(), "studio-store-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return join(root, "nested", "data"); // does not exist yet: the store must create it
}
const store = (dir, extra = {}) => createBlueprintStore({ dir, maxBytes: 10_000, ...extra });
const rejects = (p, code) => assert.rejects(p, (e) => e.code === code, code);
const FILE = /^[a-f0-9]{24}\.json$/;

test("blueprints: save, open, rename, replace, delete, and survive a restart", async (t) => {
  const dir = await folder(t);
  const a = store(dir);
  assert.deepEqual(await a.list(), [], "no folder yet means an empty list");

  const rec = await a.create({ name: "  Architect  ", markdown: "# one" });
  assert.match(rec.id, ID);
  assert.equal(rec.name, "Architect", "names are trimmed");

  const b = store(dir); // a second instance on the same folder, as after a restart
  assert.equal((await b.get(rec.id)).markdown, "# one");

  const renamed = await b.update(rec.id, { name: "Architect v2" });
  assert.deepEqual([renamed.name, renamed.markdown], ["Architect v2", "# one"], "rename keeps the Markdown");
  const replaced = await b.update(rec.id, { name: "v3", markdown: "# two" });
  assert.deepEqual([replaced.name, replaced.markdown], ["v3", "# two"]);
  assert.equal(replaced.createdAt, rec.createdAt);

  const list = await b.list();
  assert.deepEqual(list.map((x) => Object.keys(x).sort()), [["id", "name", "updatedAt"]], "summaries carry no Markdown");

  await b.remove(rec.id);
  await rejects(b.get(rec.id), "NOT_FOUND");
  await rejects(b.remove(rec.id), "NOT_FOUND");
  assert.deepEqual(await b.list(), []);
});

test("blueprints: the folder holds only <id>.json files, whatever the name says", async (t) => {
  const dir = await folder(t);
  const s = store(dir);
  for (const name of ["../../etc/passwd", "C:\\Windows\\win.ini", "a/b", "CON", ".hidden", "x".repeat(100)]) {
    await s.create({ name, markdown: "# x" });
  }
  const names = await readdir(dir);
  assert.equal(names.length, 6);
  assert.ok(names.every((n) => FILE.test(n)), names.join(","));
  assert.ok((await s.list()).some((b) => b.name === "../../etc/passwd"), "the name is data, not a path");
});

test("blueprints: an id that is not ours is NOT_FOUND before any filesystem call", async (t) => {
  const dir = await folder(t); // never created: a real lookup would be ENOENT, a bad id must not even try
  const s = store(dir);
  const bad = ["../x", "..", "a/b", "a\\b", "", " ", "ABCDEF0123456789ABCDEF01", "abc", "x".repeat(24),
    "../../../etc/passwd", "0123456789abcdef01234567.json", "0123456789abcdef01234567/../x",
    null, undefined, 7, {}, ["0123456789abcdef01234567"]];
  for (const id of bad) {
    await rejects(s.get(id), "NOT_FOUND");
    await rejects(s.update(id, { name: "n" }), "NOT_FOUND");
    await rejects(s.remove(id), "NOT_FOUND");
  }
});

test("blueprints: bad names and oversized Markdown are refused", async (t) => {
  const s = store(await folder(t), { maxBytes: 20 });
  for (const name of ["", "   ", "x".repeat(101), "a\nb", "a\u0000b", "tab\there", 5, null, undefined]) {
    await rejects(s.create({ name, markdown: "# x" }), "INVALID");
  }
  await rejects(s.create({ name: "n", markdown: 5 }), "INVALID");
  await rejects(s.create({ name: "n", markdown: "é".repeat(11) }), "TOO_LARGE"); // 22 bytes
  await s.create({ name: "n", markdown: "x".repeat(20) });                       // exactly at the cap
  const rec = (await s.list())[0];
  await rejects(s.update(rec.id, { name: "" }), "INVALID");
  await rejects(s.update(rec.id, { markdown: "x".repeat(21) }), "TOO_LARGE");
  assert.equal((await s.get(rec.id)).name, "n", "a refused update changes nothing");
});

test("blueprints: the item limit holds, even for concurrent saves", async (t) => {
  const dir = await folder(t);
  const s = store(dir, { maxItems: 10 });
  const results = await Promise.allSettled(Array.from({ length: 15 }, (_, i) => s.create({ name: `n${i}`, markdown: "# x" })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 10);
  assert.ok(results.filter((r) => r.status === "rejected").every((r) => r.reason.code === "LIMIT"));
  assert.equal((await readdir(dir)).length, 10);
});

test("blueprints: concurrent updates never leave a torn file or a temp file", async (t) => {
  const dir = await folder(t);
  const s = store(dir);
  const { id } = await s.create({ name: "start", markdown: "# x" });
  await Promise.all(Array.from({ length: 25 }, (_, i) => s.update(id, { name: `name-${i}` })));
  assert.match((await s.get(id)).name, /^name-\d+$/);
  assert.deepEqual(await readdir(dir), [`${id}.json`]);
});

test("blueprints: damaged, foreign, mismatched and linked files are skipped by list", async (t) => {
  const dir = await folder(t);
  const s = store(dir);
  const good = await s.create({ name: "good", markdown: "# x" });
  await writeFile(join(dir, "notes.txt"), "not ours");
  await writeFile(join(dir, `${"a".repeat(24)}.json`), "{");
  await writeFile(join(dir, `${"b".repeat(24)}.json`), JSON.stringify({ id: "c".repeat(24), name: "liar", markdown: "" }));
  await writeFile(join(dir, "outside.json"), JSON.stringify({ id: "d".repeat(24), name: "linked", markdown: "# secret" }));
  let linked = true;
  try {
    await symlink(join(dir, "outside.json"), join(dir, `${"d".repeat(24)}.json`));
  } catch (err) {
    linked = false;
    t.diagnostic(`no symlinks here (${err.code}); link check skipped`);
  }
  assert.deepEqual((await s.list()).map((b) => b.id), [good.id]);
  await rejects(s.get("a".repeat(24)), "CORRUPT");
  await rejects(s.get("b".repeat(24)), "CORRUPT");
  if (linked) await rejects(s.get("d".repeat(24)), "NOT_FOUND");
});

// ---------------------------------------------------------------- run history

const input = { kind: "text", markdown: "abc" };
const okResult = (over = {}) => ({
  ok: true,
  ir: { id: "coding/architect" },
  run: { provider: "xai", runtime: "mastra", model: "xai/grok-4.6", fallbacks: [],
    usage: { inputTokens: 12, outputTokens: 34, latencyMs: 5, costUsd: 0 }, ...over },
});

test("run record: success keeps provider, timing, tokens and outcome", () => {
  const r = runRecordFrom({ input, provider: "gemini", runtime: "direct", blueprintId: "a".repeat(24),
    result: okResult(), durationMs: 123.4, now: new Date("2026-10-25T12:00:00Z"), id: "r1" });
  assert.deepEqual(r, {
    id: "r1", at: "2026-10-25T12:00:00.000Z", durationMs: 123, blueprintId: "a".repeat(24),
    blueprint: "coding/architect", provider: "xai", runtime: "mastra", model: "xai/grok-4.6",
    inputTokens: 12, outputTokens: 34, outcome: "ok", fallbacks: [],
  });
});

test("run record: a fallback is its own outcome and names what failed", () => {
  const r = runRecordFrom({ input, result: okResult({ provider: "mock", runtime: "direct", fallbacks: [{ provider: "xai", reason: "HTTP 503" }] }), durationMs: 5 });
  assert.equal(r.outcome, "fallback");
  assert.deepEqual(r.fallbacks, [{ provider: "xai", reason: "HTTP 503" }]);
});

test("run record: a failure keeps codes and stage, never messages", () => {
  const result = { ok: false, stage: "provider", fallbacks: [],
    errors: [{ code: "PROVIDER_HTTP", status: 403, message: "secret gateway text sk-canary" }] };
  const r = runRecordFrom({ input, provider: "xai", result, durationMs: -5 });
  assert.deepEqual([r.outcome, r.stage, r.errorCodes, r.provider, r.runtime], ["error", "provider", ["PROVIDER_HTTP"], "xai", null]);
  assert.equal(r.durationMs, 0);
  assert.equal(r.blueprint, "text:3B");
  assert.ok(!JSON.stringify(r).includes("secret") && !JSON.stringify(r).includes("sk-canary"));
});

test("run record: URLs by host only, and untrusted strings are capped", () => {
  const url = runRecordFrom({ input: { kind: "url", url: "https://example.test/a/b?token=1" },
    result: { ok: false, stage: "load", errors: [{ code: "LOAD", message: "m" }] }, durationMs: 1 });
  assert.equal(url.blueprint, "url:example.test");
  assert.ok(!JSON.stringify(url).includes("token"));
  const long = runRecordFrom({ input, result: { ...okResult(), ir: { id: "x".repeat(300) } }, durationMs: 1 });
  assert.ok(long.blueprint.length <= 80);
});

test("run store: newest first, capped at maxRuns, one folder, damaged lines skipped", async (t) => {
  const dir = await folder(t);
  const runs = createRunStore({ dir, maxRuns: 3 });
  assert.deepEqual(await runs.list(), []);
  for (let i = 1; i <= 5; i += 1) await runs.append({ id: `r${i}` });
  assert.deepEqual((await runs.list()).map((r) => r.id), ["r5", "r4", "r3"]);
  assert.deepEqual((await runs.list(2)).map((r) => r.id), ["r5", "r4"]);
  assert.deepEqual(await readdir(dir), ["runs.jsonl"]);

  await writeFile(join(dir, "runs.jsonl"), '{"id":"a"}\nnot json\n\n{"id":"b"}\n');
  assert.deepEqual((await runs.list()).map((r) => r.id), ["b", "a"]);
});

test("run store: concurrent appends are all kept", async (t) => {
  const runs = createRunStore({ dir: await folder(t), maxRuns: 100 });
  await Promise.all(Array.from({ length: 30 }, (_, i) => runs.append({ id: `r${i}` })));
  assert.equal((await runs.list()).length, 30);
});