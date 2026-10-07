/** @typedef {{ kind: "file" | "http" | "registry", ref: string, version?: string }} SourceRef */

/**
 * @typedef {object} BlueprintIR
 * @property {string} id
 * @property {string} name
 * @property {string} domain
 * @property {string} title
 * @property {Record<string, string>} sections
 * @property {string[]} skills
 * @property {string[]} mcp
 * @property {{ preferred: string, fallbacks: string[] }} modelPolicy
 * @property {SourceRef} source
 */

/**
 * @typedef {{ code: string, message: string, path?: string }} CompileError
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
