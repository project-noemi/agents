/**
 * Shared plumbing for the Studio stores (blueprints.js, runs.js).
 *
 * Everything lives in ONE data directory (NOEMI_STUDIO_DATA_DIR). File names are
 * built only from server-generated ids or fixed constants, never from anything a
 * browser sent, so a hostile name cannot choose a path.
 */
import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * A store failure with a fixed, path-free message. server.js maps the codes
 * NOT_FOUND / INVALID / TOO_LARGE / LIMIT to HTTP statuses; anything else is a 500.
 */
export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Created lazily, owner-only, so a fresh clone needs no setup. */
export const ensureDir = (dir) => mkdir(dir, { recursive: true, mode: 0o700 });

/** Write to a temp file in the same folder, then rename: readers never see half a file. */
export async function writeAtomic(dir, fileName, text) {
  const tmp = join(dir, `.${fileName}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(tmp, text, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(tmp, join(dir, fileName));
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

/** Runs async functions one at a time, so read-modify-write cycles cannot interleave. */
export function serialize() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn);
    tail = run.catch(() => {});
    return run;
  };
}