import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeFs from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseBlueprint } from "../src/parse.js";
import { resolveBlueprint } from "../src/resolve.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const ir = (skills = [], mcp = []) => ({ skills, mcp });
const resolveIn = (root, skills, mcp, fs) => resolveBlueprint(ir(skills, mcp), { repoRoot: root }, fs);
const codes = (errors) => errors.map((e) => e.code);

// Every message is fixed text plus the persona's own ref, never a filesystem path.
function assertNoRoot(errors, root) {
  for (const e of errors) assert.ok(!e.message.includes(root), `message leaks the root: ${e.message}`);
}

test("a category/name slug resolves to a repo-relative POSIX path", async () => {
  const { resolved, errors } = await resolveIn(fixtures, ["verification/pre-flight-check"]);
  assert.deepEqual(errors, []);
  assert.deepEqual(resolved.skills, [{
    ref: "verification/pre-flight-check",
    slug: "verification/pre-flight-check",
    path: "skills/verification/pre-flight-check.md",
  }]);
});

test("a long-form skills/...md ref normalizes to the same slug", async () => {
  const { resolved, errors } = await resolveIn(fixtures, ["skills/security/pii-scan.md"]);
  assert.deepEqual(errors, []);
  assert.equal(resolved.skills[0].slug, "security/pii-scan");
  assert.equal(resolved.skills[0].path, "skills/security/pii-scan.md");
  assert.equal(resolved.skills[0].ref, "skills/security/pii-scan.md");
});

test("MCP ids resolve to .md first, then .json", async () => {
  const { resolved, errors } = await resolveIn(fixtures, [], ["github", "local-thing"]);
  assert.deepEqual(errors, []);
  assert.deepEqual(resolved.mcp.map((m) => m.path), [
    "mcp-protocols/github.md",
    "mcp-protocols/local-thing.json",
  ]);
});

test("refs that land on the same file share one resolved entry", async () => {
  const { resolved, errors } = await resolveIn(
    fixtures,
    ["security/pii-scan", "skills/security/pii-scan.md"],
    ["github", "mcp-protocols/github.md", "github.md"],
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(resolved.skills.map((s) => s.ref), ["security/pii-scan"]);
  assert.deepEqual(resolved.mcp.map((m) => m.ref), ["github"]);
});

test("an explicit MCP extension is honored, a bare id prefers .md", async (t) => {
  const root = await nodeFs.mkdtemp(join(tmpdir(), "resolve-ext-"));
  t.after(() => nodeFs.rm(root, { recursive: true, force: true }));
  await nodeFs.mkdir(join(root, "mcp-protocols"));
  await nodeFs.writeFile(join(root, "mcp-protocols", "both.md"), "md contract\n");
  await nodeFs.writeFile(join(root, "mcp-protocols", "both.json"), "{}\n");
  await nodeFs.writeFile(join(root, "mcp-protocols", "only-md.md"), "md contract\n");

  const { resolved, errors } = await resolveIn(root, [], ["both.json", "both", "only-md.json"]);
  assert.deepEqual(resolved.mcp.map((m) => m.path), ["mcp-protocols/both.json", "mcp-protocols/both.md"]);
  assert.deepEqual(codes(errors), ["UNRESOLVED_MCP"]);
  assert.match(errors[0].message, /only-md\.json\.$/);
});

test("a file whose name differs only in case does not resolve on any platform", async (t) => {
  const root = await nodeFs.mkdtemp(join(tmpdir(), "resolve-case-"));
  t.after(() => nodeFs.rm(root, { recursive: true, force: true }));
  await nodeFs.mkdir(join(root, "skills", "verification"), { recursive: true });
  await nodeFs.writeFile(join(root, "skills", "verification", "Mixed-Case.md"), "wrong case on disk\n");
  await nodeFs.mkdir(join(root, "Mcp-Protocols"));
  await nodeFs.writeFile(join(root, "Mcp-Protocols", "github.md"), "wrong-case kind root\n");

  const { resolved, errors } = await resolveIn(root, ["verification/mixed-case"], ["github"]);
  assert.deepEqual(resolved, { skills: [], mcp: [] });
  assert.deepEqual(codes(errors), ["UNRESOLVED_SKILL", "UNRESOLVED_MCP"]);
});

test("every traversal ref in the fixture fails as BAD_SLUG, all reported together", async () => {
  const parsed = parseBlueprint(readFileSync(join(fixtures, "traversal.core.md"), "utf8"));
  const total = parsed.skills.length + parsed.mcp.length;
  assert.equal(total, 6);
  const { resolved, errors } = await resolveBlueprint(parsed, { repoRoot: fixtures });
  assert.deepEqual(resolved, { skills: [], mcp: [] });
  assert.equal(errors.length, total);
  assert.ok(errors.every((e) => e.code === "BAD_SLUG"));
  assertNoRoot(errors, fixtures);
});

test("good refs survive while every bad ref is reported", async () => {
  const { resolved, errors } = await resolveIn(
    fixtures,
    ["verification/pre-flight-check", "verification/does-not-exist", "Bad/Case"],
    ["github", "nope"],
  );
  assert.equal(resolved.skills.length, 1);
  assert.equal(resolved.mcp.length, 1);
  assert.deepEqual(codes(errors), ["UNRESOLVED_SKILL", "BAD_SLUG", "UNRESOLVED_MCP"]);
  assert.deepEqual(errors.map((e) => e.path), ["verification/does-not-exist", "Bad/Case", "nope"]);
  assertNoRoot(errors, fixtures);
});

test("a directory at the candidate path does not count as resolved", async (t) => {
  const root = await nodeFs.mkdtemp(join(tmpdir(), "resolve-dir-"));
  t.after(() => nodeFs.rm(root, { recursive: true, force: true }));
  await nodeFs.mkdir(join(root, "skills", "verification", "trap.md"), { recursive: true });
  await nodeFs.mkdir(join(root, "mcp-protocols", "trap.md"), { recursive: true });
  const { errors } = await resolveIn(root, ["verification/trap"], ["trap"]);
  assert.deepEqual(codes(errors), ["UNRESOLVED_SKILL", "UNRESOLVED_MCP"]);
});

test("an oversized segment is BAD_SLUG, not an fs error", async () => {
  const long = "a".repeat(300);
  const { errors } = await resolveIn(fixtures, [`verification/${long}`], [long]);
  assert.deepEqual(codes(errors), ["BAD_SLUG", "BAD_SLUG"]);
  assert.ok(errors.every((e) => e.path.length <= 80));
});

test("a Windows device name is not resolved and does not throw", async () => {
  const { resolved, errors } = await resolveIn(fixtures, ["verification/nul"], ["con"]);
  assert.deepEqual(resolved, { skills: [], mcp: [] });
  assert.deepEqual(codes(errors), ["UNRESOLVED_SKILL", "UNRESOLVED_MCP"]);
  assertNoRoot(errors, fixtures);
});

test("refs containing line breaks are BAD_SLUG, never a throw", async () => {
  const breaks = ["a\nb", "a\rb", "a b", "a b", "github\n.md"];
  const { resolved, errors } = await resolveIn(fixtures, breaks.map((b) => `verification/${b}`), breaks);
  assert.deepEqual(resolved, { skills: [], mcp: [] });
  assert.equal(errors.length, breaks.length * 2);
  assert.ok(errors.every((e) => e.code === "BAD_SLUG"));
});

const explode = { realpath: () => assert.fail("realpath called"), stat: () => assert.fail("stat called") };

test("a ref-less IR never touches the filesystem", async () => {
  const r = await resolveIn(join(fixtures, "no-such-root"), [], [], explode);
  assert.deepEqual(r, { resolved: { skills: [], mcp: [] }, errors: [] });
});

test("an IR whose refs are all malformed never touches the filesystem", async () => {
  const { errors } = await resolveIn(join(fixtures, "no-such-root"), ["../x"], ["../y"], explode);
  assert.deepEqual(codes(errors), ["BAD_SLUG", "BAD_SLUG"]);
});

test("a missing repo root is one RESOLVE_ROOT error that does not echo the root", async () => {
  const root = join(fixtures, "no-such-root");
  const { errors } = await resolveIn(root, ["verification/pre-flight-check"], ["github"]);
  assert.deepEqual(codes(errors), ["RESOLVE_ROOT"]);
  assertNoRoot(errors, root);
});

test("a missing repo root still reports every BAD_SLUG alongside RESOLVE_ROOT", async () => {
  const root = join(fixtures, "no-such-root");
  const { errors } = await resolveIn(root, ["verification/pre-flight-check", "../x"], ["Bad"]);
  assert.deepEqual(codes(errors), ["BAD_SLUG", "BAD_SLUG", "RESOLVE_ROOT"]);
  assert.deepEqual(errors.slice(0, 2).map((e) => e.path), ["../x", "Bad"]);
});

test("a missing kind root leaves that kind's refs unresolved", async (t) => {
  const root = await nodeFs.mkdtemp(join(tmpdir(), "resolve-empty-"));
  t.after(() => nodeFs.rm(root, { recursive: true, force: true }));
  const { errors } = await resolveIn(root, ["verification/pre-flight-check"], ["github"]);
  assert.deepEqual(codes(errors), ["UNRESOLVED_SKILL", "UNRESOLVED_MCP"]);
});

test("an unexpected fs error becomes RESOLVE_FS with only the error code", async () => {
  const denied = Object.assign(new Error(`EACCES: permission denied, stat '${fixtures}'`), { code: "EACCES" });
  const fs = { realpath: nodeFs.realpath, stat: () => Promise.reject(denied) };
  const { errors } = await resolveIn(fixtures, ["verification/pre-flight-check"], ["github"], fs);
  assert.deepEqual(codes(errors), ["RESOLVE_FS", "RESOLVE_FS"]);
  assert.ok(errors.every((e) => e.message.includes("EACCES")));
  assertNoRoot(errors, fixtures);
});

test("an unreadable kind root is RESOLVE_FS, not a silent miss", async () => {
  const fs = {
    realpath: (p) => (p.endsWith("skills")
      ? Promise.reject(Object.assign(new Error("EPERM"), { code: "EPERM" }))
      : nodeFs.realpath(p)),
    stat: nodeFs.stat,
  };
  const { errors } = await resolveIn(fixtures, ["verification/pre-flight-check"], [], fs);
  assert.deepEqual(codes(errors), ["RESOLVE_FS"]);
});

// Junctions need no privilege on Windows and are plain symlinks on POSIX. Every
// link points inside mkdtemp dirs, never at the repo.
async function junction(t, target, link) {
  try {
    await nodeFs.symlink(target, link, "junction");
  } catch (err) {
    t.skip(`cannot create a junction here (${err.code})`);
    return false;
  }
  return true;
}

test("links that leave the kind root are PATH_ESCAPE, inside or outside the repo", async (t) => {
  const root = await nodeFs.mkdtemp(join(tmpdir(), "resolve-root-"));
  const outside = await nodeFs.mkdtemp(join(tmpdir(), "resolve-out-"));
  const links = [join(root, "skills", "x"), join(root, "skills", "y")];
  t.after(async () => {
    // unlink removes the link itself and never recurses into its target.
    for (const link of links) await nodeFs.unlink(link).catch(() => {});
    await nodeFs.rm(root, { recursive: true, force: true });
    await nodeFs.rm(outside, { recursive: true, force: true });
  });
  await nodeFs.mkdir(join(root, "skills"));
  await nodeFs.writeFile(join(root, "secret.md"), "inside the root, outside skills/\n");
  await nodeFs.writeFile(join(outside, "leak.md"), "outside the root\n");

  if (!(await junction(t, root, links[0]))) return;
  if (!(await junction(t, outside, links[1]))) return;

  const { resolved, errors } = await resolveIn(root, ["x/secret", "y/leak"]);
  assert.deepEqual(resolved.skills, []);
  assert.deepEqual(codes(errors), ["PATH_ESCAPE", "PATH_ESCAPE"]);
  assertNoRoot(errors, root);
});

test("a kind root that links outside the repo root is PATH_ESCAPE for every ref", async (t) => {
  const root = await nodeFs.mkdtemp(join(tmpdir(), "resolve-kind-"));
  const outside = await nodeFs.mkdtemp(join(tmpdir(), "resolve-kind-out-"));
  const links = [join(root, "skills"), join(root, "mcp-protocols")];
  t.after(async () => {
    for (const link of links) await nodeFs.unlink(link).catch(() => {});
    await nodeFs.rm(root, { recursive: true, force: true });
    await nodeFs.rm(outside, { recursive: true, force: true });
  });
  await nodeFs.mkdir(join(outside, "x"));
  await nodeFs.writeFile(join(outside, "x", "leak.md"), "outside the root\n");
  await nodeFs.writeFile(join(outside, "leak.md"), "outside the root\n");

  if (!(await junction(t, outside, links[0]))) return;
  if (!(await junction(t, outside, links[1]))) return;

  const { resolved, errors } = await resolveIn(root, ["x/leak"], ["leak"]);
  assert.deepEqual(resolved, { skills: [], mcp: [] });
  assert.deepEqual(codes(errors), ["PATH_ESCAPE", "PATH_ESCAPE"]);
  assertNoRoot(errors, root);
  assertNoRoot(errors, outside);
});
