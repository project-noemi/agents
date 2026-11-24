/**
 * Daily spend ledger for the Studio spending cap: one small file,
 * <dir>/spend.json, holding { day, usd } for the current day only.
 *
 * "Day" is a calendar day in `timeZone` (NOEMI_SPEND_TIMEZONE, default UTC);
 * the total resets when the day changes. The cap is checked BEFORE a run starts
 * and the cost is added AFTER it finishes, so a run that starts under the cap
 * can finish over it. Parallel runs can overshoot by their combined cost.
 *
 * A damaged file throws instead of reading as zero: a guard that quietly forgets
 * what was spent is not a guard.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, serialize, writeAtomic } from "./files.js";

const FILE = "spend.json";

/** @param {{ dir: string, timeZone?: string, now?: () => number }} opts */
export function createSpendLedger({ dir, timeZone = "UTC", now = Date.now }) {
  const lock = serialize();
  // en-CA formats as YYYY-MM-DD. Throws RangeError on an unknown zone; config.js checks first.
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const today = () => fmt.format(new Date(now()));

  async function read() {
    let text;
    try {
      text = await readFile(join(dir, FILE), "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return { day: today(), usd: 0 };
      throw err;
    }
    const rec = JSON.parse(text);
    if (typeof rec?.day !== "string" || !Number.isFinite(rec.usd) || rec.usd < 0) {
      throw new Error("spend ledger is damaged");
    }
    return rec.day === today() ? rec : { day: today(), usd: 0 };
  }

  return {
    /** USD spent so far today. */
    spentToday: () => lock(async () => (await read()).usd),

    /** Add a finished run's cost. Zero and non-numbers are ignored. */
    add: (usd) =>
      lock(async () => {
        if (!Number.isFinite(usd) || usd <= 0) return;
        const cur = await read();
        await ensureDir(dir);
        await writeAtomic(dir, FILE, JSON.stringify({ day: cur.day, usd: cur.usd + usd }) + "\n");
      }),
  };
}
