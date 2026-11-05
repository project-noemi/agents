/**
 * Saved blueprints: one JSON file per blueprint, all in one folder.
 *
 *   <dir>/<id>.json   { id, name, markdown, createdAt, updatedAt }
 *
 * Safe names: the file name is the server-generated id (24 lowercase hex chars)
 * and nothing else. The display name lives inside the file, so "../../etc/passwd"
 * is a legal (if silly) name and never touches a path. Ids from outside are
 * matched against ID before any filesystem call; a bad one is NOT_FOUND.
 * Symlinks in the folder are ignored.
 */
import { randomBytes } from "node:crypto";
import { lstat, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { StoreError, ensureDir, serialize, writeAtomic } from "./files.js";

export const ID = /^[a-f0-9]{24}$/;
export const MAX_NAME = 100;
export const DEFAULT_MAX_BLUEPRINTS = 200;

const FILE = /^[a-f0-9]{24}\.json$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const notFound = () => new StoreError("NOT_FOUND", "Blueprint not found.");

export function checkName(raw) {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name || name.length > MAX_NAME || CONTROL.test(name)) {
    throw new StoreError("INVALID", `name must be 1 to ${MAX_NAME} characters with no control characters.`);
  }
  return name;
}

const summary = ({ id, name, updatedAt }) => ({ id, name, updatedAt });

/**
 * @param {{ dir: string, maxBytes: number, maxItems?: number }} opts
 */
export function createBlueprintStore({ dir, maxBytes, maxItems = DEFAULT_MAX_BLUEPRINTS }) {
  const lock = serialize();

  function checkMarkdown(markdown) {
    if (typeof markdown !== "string") throw new StoreError("INVALID", "markdown must be a string.");
    if (Buffer.byteLength(markdown, "utf8") > maxBytes) {
      throw new StoreError("TOO_LARGE", `markdown is larger than the ${maxBytes}-byte limit.`);
    }
    return markdown;
  }

  async function read(id) {
    if (typeof id !== "string" || !ID.test(id)) throw notFound();
    const file = join(dir, `${id}.json`);
    let text;
    try {
      // lstat, not stat: a link planted in the folder is not a blueprint.
      if (!(await lstat(file)).isFile()) throw notFound();
      text = await readFile(file, "utf8");
    } catch (err) {
      if (err instanceof StoreError) throw err;
      if (err.code === "ENOENT" || err.code === "ENOTDIR") throw notFound();
      throw err;
    }
    let rec;
    try {
      rec = JSON.parse(text);
    } catch {
      throw new StoreError("CORRUPT", "A stored blueprint could not be read.");
    }
    if (rec?.id !== id || typeof rec.name !== "string" || typeof rec.markdown !== "string") {
      throw new StoreError("CORRUPT", "A stored blueprint could not be read.");
    }
    return rec;
  }

  const ids = async () => (await readdir(dir)).filter((n) => FILE.test(n)).map((n) => n.slice(0, -".json".length));
  const write = (rec) => writeAtomic(dir, `${rec.id}.json`, JSON.stringify(rec));

  return {
    /** Summaries, newest save first. Unreadable files are skipped, not fatal. */
    async list() {
      await ensureDir(dir);
      const recs = await Promise.all((await ids()).map((id) => read(id).catch(() => null)));
      return recs.filter(Boolean).map(summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    get: read,

    create: ({ name, markdown }) =>
      lock(async () => {
        const clean = { name: checkName(name), markdown: checkMarkdown(markdown) };
        await ensureDir(dir);
        if ((await ids()).length >= maxItems) {
          throw new StoreError("LIMIT", `The ${maxItems}-blueprint limit is reached. Delete one first.`);
        }
        const now = new Date().toISOString();
        const rec = { id: randomBytes(12).toString("hex"), ...clean, createdAt: now, updatedAt: now };
        await write(rec);
        return rec;
      }),

    /** Rename and/or replace the Markdown. Fields left undefined are kept. */
    update: (id, { name, markdown } = {}) =>
      lock(async () => {
        const old = await read(id);
        const rec = {
          ...old,
          name: name === undefined ? old.name : checkName(name),
          markdown: markdown === undefined ? old.markdown : checkMarkdown(markdown),
          updatedAt: new Date().toISOString(),
        };
        await write(rec);
        return rec;
      }),

    remove: (id) =>
      lock(async () => {
        await read(id);
        await rm(join(dir, `${id}.json`));
      }),
  };
}