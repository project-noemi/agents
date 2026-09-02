import { REQUIRED_HEADINGS } from "./ir.js";

function hasRefusal(sections) {
  if (sections["Refusal Criteria"]) return true;
  const rules = sections["Rules & Constraints"] ?? "";
  return /refusal criteria/i.test(rules);
}

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

  if (!hasRefusal(ir.sections)) {
    errors.push({
      code: "MISSING_REFUSAL",
      message: 'Required subsection "Refusal Criteria" is missing under Rules & Constraints.',
      path: "Refusal Criteria",
    });
  }

  if (!ir.title) {
    errors.push({
      code: "PARSE",
      message: "Blueprint is missing an H1 title.",
    });
  }

  return errors;
}
