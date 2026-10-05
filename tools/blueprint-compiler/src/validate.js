import { REQUIRED_HEADINGS } from "./ir.js";

/**
 * @param {import("./ir.js").BlueprintIR} ir
 * @returns {import("./ir.js").CompileError[]}
 */
export function validateBlueprint(ir) {
  const errors = [];

  for (const heading of REQUIRED_HEADINGS) {
    const body = ir.sections[heading];
    if (!body || !body.trim()) {
      errors.push({
        code: "MISSING_HEADING",
        message: `Required heading "${heading}" is missing or empty.`,
        path: heading,
      });
    }
  }

  // A prose mention of "refusal criteria" no longer counts. The parser only fills
  // ir.refusalCriteria from a real `### Refusal Criteria` under Rules & Constraints.
  if (typeof ir.refusalCriteria !== "string" || !ir.refusalCriteria.trim()) {
    errors.push({
      code: "MISSING_REFUSAL",
      message:
        'Required subsection "### Refusal Criteria" is missing, empty, or not under "Rules & Constraints".',
      path: "Refusal Criteria",
    });
  }

  if (!ir.title) {
    errors.push({ code: "PARSE", message: "Blueprint is missing an H1 title." });
  }

  return errors;
}