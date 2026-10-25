/**
 * Deterministic offline provider. Supports the same onToken callback as live
 * providers so streaming behavior can be tested without network access.
 */
export async function runMock(ir, prompt, opts = {}) {
  const role = (ir.sections.Role ?? "").split("\n")[0];
  const output = [
    `[mock] compiled ${ir.id}`,
    `title: ${ir.title}`,
    `role: ${role}`,
    `skills: ${ir.skills.join(", ") || "(none)"}`,
    `prompt: ${prompt}`,
  ].join("\n");

  if (typeof opts.onToken === "function") {
    for (const chunk of output.match(/\S+\s*/g) ?? []) opts.onToken(chunk);
  }

  return {
    provider: "mock",
    model: "mock-hello-world",
    output,
    usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0, costUsd: 0 },
  };
}
