/**
 * Sprint 1 provider. No network. Deterministic.
 * Uses the same incremental onToken callback as live providers.
 *
 * @param {import("../ir.js").BlueprintIR} ir
 * @param {string} prompt
 * @param {{ onToken?: (text: string) => void }} [opts]
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

  if (onToken) {
    const chunks = output.match(/\S+\s*/g) ?? [];

    for (const chunk of chunks) {
      onToken(chunk);

      // Yield to the event loop so an HTTP server can flush each chunk
      // before the next one is generated.
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return {
    provider: "mock",
    model: "mock-hello-world",
    output,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      costUsd: 0,
    },
  };
}