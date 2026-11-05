// Builders are pure; only writeAudit touches a stream. compileSource never logs.
// Never put the prompt, env values, or keys in a record.
import { parseRegistryRef } from "./loaders/registry.js";

const STAGES = {
  load: ["load"],
  validate: ["parse", "validate"],
  resolve: ["parse", "validate", "resolve"],
  provider: ["parse", "validate", "resolve", "run"],
  internal: [],
};

export const auditRecord = ({ task, inputs = [], actions = [], risks = [], result }) =>
  ({ task, inputs, actions, risks, result });

/**
 * @param {object} r compileFile/compileSource result
 * @param {{file?: string, provider?: string, runtime?: string}} ctx
 */
export function auditFromCompile(r, { file, provider, runtime } = {}) {
  // `runtime` is only listed when --runtime was passed, so existing records keep their shape.
  const inputs = [file, provider ?? "(from config)", ...(runtime ? [runtime] : [])];
  if (r.ok) {
    const fell = r.run.fallbacks ?? [];
    const via = r.run.runtime === "mastra" ? "+mastra" : "";
    return auditRecord({
      task: `compile:${r.ir.id}`,
      inputs,
      actions: ["parse", "validate", "resolve", ...fell.map((f) => `fallback-from:${f.provider}`), `run:${r.run.provider}${via}`],
      risks: fell.map((f) => `${f.provider} failed (${f.reason}); fell back`),
      result: "ok",
    });
  }
  const fell = r.fallbacks ?? [];
  return auditRecord({
    task: `compile:${file}`,
    inputs,
    actions: [...(STAGES[r.stage] ?? []), ...fell.map((f) => `fallback-from:${f.provider}`)],
    risks: [
      ...fell.map((f) => `${f.provider} failed (${f.reason}); fell back`),
      ...r.errors.map((e) => `${e.code}: ${e.message}`),
    ],
    result: `error:${r.errors.map((e) => e.code).join(",")}`,
  });
}

const cap = (s) => (s.length > 80 ? `${s.slice(0, 77)}...` : s);
const fallbackActions = (fell) => fell.map((f) => `fallback-from:${f.provider}`);
const fallbackRisks = (fell) => fell.map((f) => `${f.provider} failed (${f.reason}); fell back`);

/**
 * Where a Studio persona came from, without what it said or who sent it:
 * pasted text by size only, a URL by host only (a path or query can name a
 * person), a registry ref only once it has passed the registry's own pattern.
 */
export function describeInput(input) {
  switch (input?.kind) {
    case "text":
      return `text:${Buffer.byteLength(String(input.markdown ?? ""), "utf8")}B`;
    case "url":
      try { return `url:${cap(new URL(input.url).hostname)}`; } catch { return "url:(invalid)"; }
    case "registry":
      try {
        const { ref, version } = parseRegistryRef(input.ref);
        return `registry:${ref}${version ? `@${version}` : ""}`;
      } catch { return "registry:(invalid)"; }
    default:
      return "(none)";
  }
}

/**
 * One record per Studio server request. Risks carry error codes, never error
 * messages: loader messages repeat the full URL, and provider messages can
 * echo gateway text. Prompts, Markdown, model output, client addresses and
 * headers are never inputs.
 * @param {{ route: string, input?: object, provider?: string, runtime?: string,
 *   rejected?: { status: number, reason: string }, disconnected?: boolean }} req
 * @param {object} [r] compile or check result; absent for rejected requests and plain GETs
 */
export function auditFromRequest(req, r) {
  const { route, input, provider, runtime } = req;
  const inputs = [
    ...(input !== undefined ? [describeInput(input)] : []),
    ...(route === "run" ? [provider ?? "(from config)", ...(runtime ? [runtime] : [])] : []),
  ];
  const task = `studio:${route}${r?.ok ? `:${r.ir.id}` : ""}`;
  const gone = req.disconnected ? ["client disconnected before the result was sent"] : [];

  if (req.rejected) {
    return auditRecord({ task, inputs, risks: [req.rejected.reason], result: `rejected:${req.rejected.status}` });
  }
  if (!r) return auditRecord({ task, inputs, actions: [route], result: "ok" });

  if (r.ok) {
    const fell = r.run?.fallbacks ?? [];
    const via = r.run?.runtime === "mastra" ? "+mastra" : "";
    return auditRecord({
      task,
      inputs,
      actions: ["parse", "validate", "resolve", ...fallbackActions(fell), ...(r.run ? [`run:${r.run.provider}${via}`] : [])],
      risks: [...fallbackRisks(fell), ...gone],
      result: "ok",
    });
  }
  const fell = r.fallbacks ?? [];
  return auditRecord({
    task,
    inputs,
    actions: [...(STAGES[r.stage] ?? []), ...fallbackActions(fell)],
    risks: [...fallbackRisks(fell), ...r.errors.map((e) => e.code), ...gone],
    result: `error:${r.errors.map((e) => e.code).join(",")}`,
  });
}

export const writeAudit = (record, stream = process.stderr) =>
  stream.write(JSON.stringify(record) + "\n");