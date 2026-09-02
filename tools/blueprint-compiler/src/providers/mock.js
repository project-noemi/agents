/**
 * Sprint 1 provider. No network. Deterministic.
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 */
export async function runMock(ir, prompt) {
  const role = (ir.sections.Role ?? "").split("\n")[0];
  return {
    provider: "mock",
    model: "mock-hello-world",
    output: [
      `[mock] compiled ${ir.id}`,
      `title: ${ir.title}`,
      `role: ${role}`,
      `skills: ${ir.skills.join(", ") || "(none)"}`,
      `prompt: ${prompt}`,
    ].join("\n"),
    usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0, costUsd: 0 },
  };
}
