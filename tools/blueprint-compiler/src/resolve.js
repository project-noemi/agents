import * as nodeFs from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";

// Lowercase-hyphen segments, bounded so a hostile slug cannot hit ENAMETOOLONG.
const SEG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SEG = 64;
const MAX_ECHO = 80;
const NOT_THERE = new Set(["ENOENT", "ENOTDIR"]);

const okSeg = (s) => s.length <= MAX_SEG && SEG.test(s);
const cap = (s) => (s.length > MAX_ECHO ? `${s.slice(0, MAX_ECHO - 3)}...` : s);
const fsCode = (err) => (typeof err?.code === "string" ? err.code : "UNKNOWN");
const fsMiss = (err) => (NOT_THERE.has(err?.code) ? { missing: true } : { fsCode: fsCode(err) });

// Messages are fixed text plus the persona's own (capped) ref. Never a filesystem
// path: Node fs messages carry absolute paths, which carry the username.
const fail = (code, ref, message) => ({ code, message, path: cap(ref) });

/** `real` relative to `root` if strictly inside it, else null. */
function inside(root, real) {
  const rel = relative(root, real);
  return rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) ? null : rel;
}

// On case-insensitive filesystems realpath returns the on-disk case. A name that
// matches only case-insensitively would resolve here and fail on Linux CI.
const caseOnly = (rel, expected) => rel !== expected && rel.toLowerCase() === expected.toLowerCase();

const KINDS = [
  {
    key: "skills", dir: "skills", label: "Skill", unresolved: "UNRESOLVED_SKILL",
    badSlug: "is not a category/name slug",
    target(ref) {
      const parts = ref.trim().replace(/^skills\//, "").replace(/\.md$/, "").split("/");
      if (parts.length !== 2 || !parts.every(okSeg)) return null;
      const slug = parts.join("/");
      return { name: slug, entry: { ref, slug }, candidates: [[parts[0], `${parts[1]}.md`]] };
    },
  },
  {
    key: "mcp", dir: "mcp-protocols", label: "MCP", unresolved: "UNRESOLVED_MCP",
    badSlug: "is not a lowercase-hyphen id",
    target(ref) {
      // Plain string ops, not a capturing regex: any input (newlines included)
      // must fall through to okSeg and come back as BAD_SLUG, never throw.
      const bare = ref.trim().replace(/^mcp-protocols\//, "");
      const ext = [".md", ".json"].find((e) => bare.endsWith(e));
      const id = ext ? bare.slice(0, -ext.length) : bare;
      if (!okSeg(id)) return null;
      // An explicit extension is honored; a bare id tries .md, then .json.
      const exts = ext ? [ext] : [".md", ".json"];
      return { name: id, entry: { ref, id }, candidates: exts.map((e) => [`${id}${e}`]) };
    },
  },
];

/** realpath first, then contain, then stat the real path. */
async function locate(fs, realRoot, segments) {
  let real;
  try {
    real = await fs.realpath(join(realRoot, ...segments));
  } catch (err) {
    return fsMiss(err);
  }
  const rel = inside(realRoot, real);
  if (rel === null) return { escape: true };
  if (caseOnly(rel, join(...segments))) return { missing: true };
  try {
    return (await fs.stat(real)).isFile() ? { found: true } : { missing: true };
  } catch (err) {
    return fsMiss(err);
  }
}

const badSlug = (kind, ref) => fail("BAD_SLUG", ref, `${kind.label} ref "${cap(ref)}" ${kind.badSlug}.`);

/** Look up one well-formed ref ({ ref, t } with t from kind.target). */
async function lookup(fs, kind, rootFor, { ref, t }) {
  const paths = t.candidates.map((segs) => [kind.dir, ...segs].join("/"));
  const root = await rootFor(kind.dir);
  let hit = root;
  let i = 0;
  if (root.real) {
    for (; i < t.candidates.length; i += 1) {
      hit = await locate(fs, root.real, t.candidates[i]);
      if (!hit.missing) break;
    }
  }

  if (hit.found) return { entry: { ...t.entry, path: paths[i] } };
  if (hit.rootEscape) return { error: fail("PATH_ESCAPE", ref, `${kind.dir}/ resolves outside the repo root.`) };
  if (hit.escape) return { error: fail("PATH_ESCAPE", ref, `${kind.label} "${t.name}" resolves outside ${kind.dir}/.`) };
  if (hit.fsCode) return { error: fail("RESOLVE_FS", ref, `Cannot check ${kind.label} "${t.name}" (${hit.fsCode}).`) };
  return { error: fail(kind.unresolved, ref, `${kind.label} "${t.name}" not found at ${paths.join(" or ")}.`) };
}

/**
 * Map ir.skills to skills/{category}/{name}.md and ir.mcp to mcp-protocols/{id}.md|.json.
 * Collects every error. Each ref yields one error or one resolved entry; refs that
 * land on the same file share one entry. Output paths are logical, repo-relative,
 * POSIX. skills-dist/ is not consulted (deferred).
 * Proves existence at compile time only; readers must re-check containment.
 * @param {import("./ir.js").BlueprintIR} ir
 * @param {{ repoRoot: string }} opts
 * @param {{ realpath: Function, stat: Function }} [fs] internal; tests inject failures
 * @returns {Promise<{ resolved: import("./ir.js").ResolvedRefs, errors: import("./ir.js").CompileError[] }>}
 */
export async function resolveBlueprint(ir, { repoRoot }, fs = nodeFs) {
  const resolved = { skills: [], mcp: [] };
  // Slug checks need no filesystem, so BAD_SLUG is always reported, even when
  // the root is unusable. Only well-formed refs ever touch the filesystem.
  const work = KINDS.map((kind) => ir[kind.key].map((ref) => ({ ref, t: kind.target(ref) })));
  const badSlugs = () => KINDS.flatMap((kind, k) =>
    work[k].filter((w) => !w.t).map((w) => badSlug(kind, w.ref)));
  if (!work.some((items) => items.some((w) => w.t))) return { resolved, errors: badSlugs() };

  let realRepo;
  try {
    realRepo = await fs.realpath(repoRoot);
  } catch (err) {
    return {
      resolved,
      errors: [...badSlugs(), NOT_THERE.has(err?.code)
        ? { code: "RESOLVE_ROOT", message: "Configured repo root does not exist." }
        : { code: "RESOLVE_FS", message: `Cannot read the configured repo root (${fsCode(err)}).` }],
    };
  }

  // Each kind root is realpath'd once and must itself stay inside the repo root.
  const roots = new Map();
  const rootFor = (dir) => {
    if (!roots.has(dir)) {
      roots.set(dir, fs.realpath(join(realRepo, dir)).then((real) => {
        const rel = inside(realRepo, real);
        if (rel === null) return { rootEscape: true };
        return caseOnly(rel, dir) ? { missing: true } : { real };
      }, fsMiss));
    }
    return roots.get(dir);
  };

  // Refs are independent: look them all up concurrently, then report in order.
  const results = await Promise.all(KINDS.map((kind, k) =>
    Promise.all(work[k].map((w) => (w.t ? lookup(fs, kind, rootFor, w) : { error: badSlug(kind, w.ref) })))));

  const errors = [];
  KINDS.forEach((kind, k) => {
    const seen = new Set();
    for (const r of results[k]) {
      if (r.error) errors.push(r.error);
      else if (!seen.has(r.entry.path)) {
        seen.add(r.entry.path);
        resolved[kind.key].push(r.entry);
      }
    }
  });

  return { resolved, errors };
}
