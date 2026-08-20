'use strict';

/**
 * Loop profiles (Decision [2026-08-20-0007]).
 *
 * Same product loop, same identities, same host. A profile constrains
 * *which paths Stage B/C may touch* and *which template the writer fills*.
 * Default is `code`. `spec` is how we deploy the loop for writing agents
 * and skills without a second Mastra/runtime.
 */

const PROFILES = {
  code: {
    id: 'code',
    // null = any path except carve-outs (current Stage C).
    allowPrefixes: null,
    denyPrefixes: [],
    denyExact: [],
    templateHint: null,
  },
  spec: {
    id: 'spec',
    allowPrefixes: ['agents/', 'skills/', 'docs/agents/'],
    denyPrefixes: ['skills-dist/'],
    denyExact: [
      'skills/SKILL_TEMPLATE.md',
      'docs/AGENT_TEMPLATE.md',
      'GEMINI.md',
      'CLAUDE.md',
      'agents/guardian/jailbreak-monitor-agent.json',
    ],
    templateHint: 'Fill docs/AGENT_TEMPLATE.md or skills/SKILL_TEMPLATE.md. No TBD. Do not write generated GEMINI.md, CLAUDE.md, or skills-dist/.',
  },
};

function resolveProfile(name) {
  const id = name == null || name === '' ? 'code' : String(name);
  const profile = PROFILES[id];
  if (!profile) {
    const err = new Error(`Unknown --profile ${id} (code|spec).`);
    err.status = 400;
    throw err;
  }
  return profile;
}

function pathAllowedByProfile(filePath, profile) {
  const { normalizeRepoPath, isCarvedOut } = require('./writer.js');
  const resolved = typeof profile === 'string' || profile == null
    ? resolveProfile(profile)
    : profile;
  const normalized = normalizeRepoPath(filePath);
  if (!normalized || normalized.includes('..') || normalized.startsWith('/')) return false;
  if (isCarvedOut(normalized)) return false;
  if (resolved.denyExact.includes(normalized)) return false;
  if (resolved.denyPrefixes.some((prefix) => normalized === prefix.replace(/\/$/, '') || normalized.startsWith(prefix))) {
    return false;
  }
  if (!resolved.allowPrefixes) return true;
  return resolved.allowPrefixes.some((prefix) => normalized.startsWith(prefix));
}

function pathsOutsideProfile(paths, profile) {
  const resolved = resolveProfile(profile && profile.id ? profile.id : profile);
  return (Array.isArray(paths) ? paths : []).filter((filePath) => !pathAllowedByProfile(filePath, resolved));
}

module.exports = {
  PROFILES,
  resolveProfile,
  pathAllowedByProfile,
  pathsOutsideProfile,
};
