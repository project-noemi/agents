/**
 * Shared utility for building agent context from a Blueprint IR.
 * All providers must include the same persona sections to ensure
 * rules, constraints, and refusal criteria reach the runtime.
 *
 * @param {import("../ir.js").BlueprintIR} ir
 * @returns {string}
 */
export function buildAgentContext(ir) {
  const role = (ir.sections.Role ?? "").split("\n")[0];
  const rules = ir.sections["Rules & Constraints"] ?? "";
  const refusal = ir.sections["Refusal Criteria"] ?? "";

  const parts = [
    `You are compiling and running the NoéMI persona "${ir.title}".`,
    `Role: ${role}`,
    `Skills: ${ir.skills.join(", ") || "(none)"}`,
  ];

  if (rules) {
    parts.push(`Rules & Constraints: ${rules}`);
  }

  if (refusal) {
    parts.push(`Refusal Criteria: ${refusal}`);
  }

  return parts.join("\n");
}
