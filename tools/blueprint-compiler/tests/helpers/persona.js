export function persona({
  rules = "1. Be safe.\n\n### Refusal Criteria\n1. Refused Task Types: none.",
  boundaries = "- **Never:** break things.",
  workflow = "Do nothing.",
  tail = "",
} = {}) {
  return `# Test — Coding Agent

## Role
Test role.

## Tone
Terse.

## Capabilities
- Exist.

## Mission
Test.

## Rules & Constraints (4D Diligence)
${rules}

## Data Inventory
- **Inputs:** None.

## Boundaries
${boundaries}

## Workflow
${workflow}

## Audit Log
None.

## External Tooling Dependencies
- None
${tail}`;
}