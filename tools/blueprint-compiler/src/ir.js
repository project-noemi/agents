/** @typedef {{ kind: "file" | "http" | "registry", ref: string, version?: string }} SourceRef */

/**
 * @typedef {object} BlueprintIR
 * @property {string} id
 * @property {string} name
 * @property {string} domain
 * @property {string} title
 * @property {Record<string, string>} sections
 * @property {string} refusalCriteria  trimmed body of ### Refusal Criteria; non-empty on a valid blueprint
 * @property {string[]} skills
 * @property {string[]} mcp
 * @property {{ preferred: string, fallbacks: string[] }} modelPolicy
 * @property {SourceRef} source
 */

/**
 * @typedef {{ code: string, message: string, path?: string }} CompileError
 */

/**
 * Resolver output. Returned beside the IR, not inside it: the IR shape is
 * client-agreed (REQUIREMENTS.md §5). Paths are repo-relative POSIX.
 * @typedef {{
 *   skills: { ref: string, slug: string, path: string }[],
 *   mcp: { ref: string, id: string, path: string }[],
 * }} ResolvedRefs
 */

export const REQUIRED_HEADINGS = [
  "Role",
  "Tone",
  "Capabilities",
  "Mission",
  "Rules & Constraints",
  "Data Inventory",
  "Boundaries",
  "Workflow",
  "Audit Log",
  "External Tooling Dependencies",
];
