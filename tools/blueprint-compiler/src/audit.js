// Builders are pure; only writeAudit touches a stream. compileSource never logs.
// Never put the prompt, env values, or keys in a record.

const STAGES = {
  load: ["load"],
  validate: ["parse", "validate"],
  provider: ["parse", "validate", "run"],
  internal: [],
};

export const auditRecord = ({ task, inputs = [], actions = [], risks = [], result }) =>
  ({ task, inputs, actions, risks, result });

/** @param {object} r compileFile/compileSource result @param {{file?: string, provider?: string}} ctx */
export function auditFromCompile(r, { file, provider } = {}) {
  const inputs = [file, provider ?? "(from config)"];
  if (r.ok) {
    const fell = r.run.fallbacks ?? [];
    return auditRecord({
      task: `compile:${r.ir.id}`,
      inputs,
      actions: ["parse", "validate", ...fell.map((f) => `fallback-from:${f.provider}`), `run:${r.run.provider}`],
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

export const writeAudit = (record, stream = process.stderr) =>
  stream.write(JSON.stringify(record) + "\n");