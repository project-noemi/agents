/**
 * Saved Arena runs and the scoreboard built from them: one JSON line per run in
 * <dir>/arena.jsonl, next to runs.jsonl and the saved blueprints.
 *
 * Same privacy rule as runs.js and arena.js: provider, model, timing, tokens,
 * cost and error CODES only. Never the prompt, the persona text, any model
 * output or an error message. Capped at maxRuns, oldest dropped first, so the
 * scoreboard totals cover the runs still kept.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, serialize, writeAtomic } from "./files.js";

export const DEFAULT_MAX_ARENA_RUNS = 500;
const FILE = "arena.jsonl";

const cap = (v, n = 80) => {
  const s = String(v ?? "");
  return s.length > n ? `${s.slice(0, n - 3)}...` : s;
};
const count = (n) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
const money = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Pure: the stored record for a finished Arena run (the summary runArena hands
 * to onComplete). `blueprintId` only links the row to a saved blueprint.
 */
export function arenaRecordFrom(summary, blueprintId) {
  return {
    id: cap(summary.id, 40),
    at: summary.at,
    durationMs: count(summary.durationMs),
    ...(blueprintId ? { blueprintId } : {}),
    blueprint: cap(summary.blueprint),
    results: (summary.results ?? []).map((r) => ({
      provider: cap(r.provider, 40),
      ok: r.ok === true,
      ...(r.model ? { model: cap(r.model) } : {}),
      latencyMs: count(r.latencyMs),
      inputTokens: count(r.inputTokens),
      outputTokens: count(r.outputTokens),
      costUsd: money(r.costUsd),
      ...(r.ok ? {} : { stage: cap(r.stage, 20), errorCodes: (r.errorCodes ?? []).slice(0, 10).map((c) => cap(c, 40)) }),
    })),
  };
}

/**
 * Pure: one row per provider, totalled over the records.
 * Matches ScoreboardRow in studio/src/api/types.ts. avgLatencyMs is over
 * successful answers only (null when there are none). Sorted by provider name;
 * ranking is the Studio's job (rankRows).
 */
export function scoreboardFrom(records) {
  const rows = new Map();
  for (const rec of records) {
    for (const r of rec.results ?? []) {
      if (typeof r?.provider !== "string") continue;
      let row = rows.get(r.provider);
      if (!row) {
        row = { provider: r.provider, runs: 0, ok: 0, failed: 0, latencySum: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
        rows.set(r.provider, row);
      }
      row.runs += 1;
      row.inputTokens += count(r.inputTokens);
      row.outputTokens += count(r.outputTokens);
      row.costUsd += money(r.costUsd);
      if (r.ok) {
        row.ok += 1;
        row.latencySum += count(r.latencyMs);
      } else {
        row.failed += 1;
      }
    }
  }
  return [...rows.values()]
    .sort((a, b) => a.provider.localeCompare(b.provider))
    .map(({ latencySum, costUsd, ...row }) => ({
      ...row,
      avgLatencyMs: row.ok ? Math.round(latencySum / row.ok) : null,
      costUsd: Math.round(costUsd * 1e10) / 1e10,
    }));
}

/** @param {{ dir: string, maxRuns?: number }} opts */
export function createArenaStore({ dir, maxRuns = DEFAULT_MAX_ARENA_RUNS }) {
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
        // A damaged line costs one run, not the scoreboard.
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

    scoreboard: async () => scoreboardFrom(await readAll()),
  };
}
