/**
 * Run history for the Studio table view: one JSON line per run in
 * <dir>/runs.jsonl, the same folder as the saved blueprints.
 *
 * A record holds provider, timing, tokens and outcome. It never holds the prompt,
 * the persona text, the model output or an error message (error CODES only),
 * the same rule as the audit record. The file is rewritten atomically and capped
 * at maxRuns, oldest dropped first.
 */
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describeInput } from "../audit.js";
import { ensureDir, serialize, writeAtomic } from "./files.js";

export const DEFAULT_MAX_RUNS = 500;
const FILE = "runs.jsonl";

const cap = (v, n = 80) => {
  const s = String(v ?? "");
  return s.length > n ? `${s.slice(0, n - 3)}...` : s;
};
const count = (n) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

/**
 * Pure: build one history record from a finished /api/run.
 * `provider` and `runtime` are what the caller asked for; they are replaced by
 * who actually answered when the run succeeded.
 */
export function runRecordFrom({
  input, provider, runtime, blueprintId, result, durationMs,
  now = new Date(), id = randomBytes(12).toString("hex"),
}) {
  const run = result.ok ? result.run : undefined;
  const fallbacks = (run?.fallbacks ?? result.fallbacks ?? []).map((f) => ({
    provider: cap(f.provider, 40),
    reason: cap(f.reason, 40),
  }));
  const usage = run?.usage ?? {};

  return {
    id,
    at: now.toISOString(),
    durationMs: count(durationMs),
    ...(blueprintId ? { blueprintId } : {}),
    blueprint: result.ok ? cap(result.ir.id) : describeInput(input),
    provider: run?.provider ?? provider ?? null,
    runtime: run?.runtime ?? runtime ?? null,
    ...(run?.model ? { model: cap(run.model) } : {}),
    inputTokens: count(usage.inputTokens),
    outputTokens: count(usage.outputTokens),
    outcome: !result.ok ? "error" : fallbacks.length ? "fallback" : "ok",
    ...(result.ok
      ? {}
      : { stage: cap(result.stage, 20), errorCodes: result.errors.slice(0, 10).map((e) => cap(e.code, 40)) }),
    fallbacks,
  };
}

/** @param {{ dir: string, maxRuns?: number }} opts */
export function createRunStore({ dir, maxRuns = DEFAULT_MAX_RUNS }) {
  const lock = serialize();

  async function readAll() {
    let text;
    try {
      text = await readFile(join(dir, FILE), "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
    const out = [];
    for (const line of text.split("\n")) {
      if (!line) continue;
      try {
        const rec = JSON.parse(line);
        if (rec && typeof rec === "object") out.push(rec);
      } catch {
        // A damaged line costs one history row, not the table.
      }
    }
    return out;
  }

  return {
    append: (record) =>
      lock(async () => {
        await ensureDir(dir);
        const kept = [...(await readAll()), record].slice(-maxRuns);
        await writeAtomic(dir, FILE, kept.map((r) => JSON.stringify(r)).join("\n") + "\n");
      }),

    /** Newest first. */
    list: async (limit = 100) => (await readAll()).slice(-limit).reverse(),
  };
}