import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Maps environment to model policy. Reads env at CALL time (tests mutate
// process.env per test), so never cache this at module load.
// AI_GW_* variables belong to providers/gateway.js (Section 2), not here.
export function loadModelPolicy(env = process.env) {
  return {
    // `||`, not `??`: an empty NOEMI_PREFERRED_PROVIDER="" must mean "unset".
    preferred: env.NOEMI_PREFERRED_PROVIDER?.trim() || "mock",
    fallbacks: (env.NOEMI_FALLBACK_PROVIDERS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

// src/ -> blueprint-compiler/ -> tools/ -> repo root.
// resolve() drops the trailing separator so default and override roots look alike.
const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

// Root that skills/ and mcp-protocols/ resolve against. Same call-time rule.
// A relative NOEMI_REPO_ROOT resolves against the process cwd; prefer absolute.
export function loadResolverConfig(env = process.env) {
  const override = env.NOEMI_REPO_ROOT?.trim();
  return { repoRoot: override ? resolve(override) : DEFAULT_REPO_ROOT };
}
