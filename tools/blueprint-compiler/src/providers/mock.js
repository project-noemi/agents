/**
 * Sprint 1 provider. No network. Deterministic.
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 */
export async function runMock(ir, prompt, { onToken } = {}) {
  const role = (ir.sections.Role ?? "").split("\n")[0];
  const output = [
    `[mock] compiled ${ir.id}`,
    `title: ${ir.title}`,
    `role: ${role}`,
    `skills: ${ir.skills.join(", ") || "(none)"}`,
    `prompt: ${prompt}`,
  ].join("\n");

  // Match the streaming callback used by live providers.
  if (onToken) {
    const chunks = output.match(/\S+\s*/g) ?? [];
    for (const chunk of chunks) onToken(chunk);
  }

  return {
    provider: "mock",
    model: "mock-hello-world",
    output,
    usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0, costUsd: 0 },
  };
}