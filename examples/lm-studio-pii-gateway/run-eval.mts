// run-eval.mts — score pii-gateway.mts against the synthetic test set.
// Usage: PII_MODEL=<lm-studio-model-key> node run-eval.mts [test-set.json]
import { readFileSync } from "node:fs";
import { scan } from "./pii-gateway.mts";

type Item = { type: string; value: string; variants?: string[] };
type Doc = { id: string; kind: string; text: string; pii: Item[]; keep: string[] };

const file = process.argv[2] ?? new URL("./test-set.json", import.meta.url);
const docs: Doc[] = JSON.parse(readFileSync(file, "utf8")).documents;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whole-word match, so "Tom" does not hit "Tomorrow".
const present = (text: string, s: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, "u").test(text);
// Words of 4+ characters: catches partial leaks such as a surname left behind.
const words = (s: string) => s.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4);

let planted = 0;
let caught = 0;
let keepTotal = 0;
let kept = 0;
let blocked = 0;
const misses: string[] = [];
const overRedacted: string[] = [];
const times: number[] = [];

for (const doc of docs) {
  const start = performance.now();
  const result = await scan(doc.text, "public_api");
  times.push(performance.now() - start);

  if (result.status === "BLOCKED") {
    blocked++;
    console.log(`${doc.id}: BLOCKED (${result.reason})`);
    continue;
  }
  const out = (result.payload ?? "").replace(/\[REDACTED_[A-Z_]+\]/g, " ");
  for (const item of doc.pii) {
    planted++;
    const left = [item.value, ...(item.variants ?? []), ...words(item.value)].filter((s) => present(out, s));
    if (left.length === 0) caught++;
    else misses.push(`${doc.id} ${item.type}: ${[...new Set(left)].join(", ")}`);
  }
  for (const phrase of doc.keep) {
    keepTotal++;
    if (out.includes(phrase)) kept++;
    else overRedacted.push(`${doc.id}: "${phrase}"`);
  }
}

const sorted = [...times].sort((a, b) => a - b);
const pct = (p: number) => (sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] / 1000).toFixed(1);
const recall = planted ? ((100 * caught) / planted).toFixed(0) : "n/a";

console.log(`\nDocuments:          ${docs.length} (${blocked} blocked)`);
console.log(`PII caught:         ${caught}/${planted} (${recall}%)`);
console.log(`Non-PII kept:       ${kept}/${keepTotal} (${keepTotal - kept} over-redacted)`);
console.log(`Seconds per doc:    p50 ${pct(50)} / p95 ${pct(95)}`);
if (misses.length) console.log(`\nMissed (synthetic values):\n  ${misses.join("\n  ")}`);
if (overRedacted.length) console.log(`\nOver-redacted:\n  ${overRedacted.join("\n  ")}`);
console.log(`\n| ${process.env.PII_MODEL || "model?"} | ${docs.length} | ${planted} | ${caught} | ${recall}% | ${keepTotal - kept} | ${pct(50)} s / ${pct(95)} s |`);

process.exitCode = blocked || misses.length ? 1 : 0;
