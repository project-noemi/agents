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