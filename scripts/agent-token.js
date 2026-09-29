'use strict';

/**
 * Producer-token selection for noemi-agent.
 *
 * AGENT_GH_TOKEN is the default fine-grained PAT (home repo).
 * AGENT_GH_TOKEN_CLASSIC is a classic PAT for cross-org work (live-fire).
 * AGENT_GH_USE_CLASSIC=1|true|yes selects classic and MUST NOT fall back.
 */

function wantsClassic(env = process.env) {
  const v = String((env && env.AGENT_GH_USE_CLASSIC) || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function describeProducerTokenShape(token) {
  if (typeof token !== 'string' || token.length === 0) return 'empty';
  if (token.startsWith('github_pat_')) return 'fine-grained';
  if (token.startsWith('ghp_')) return 'classic';
  return 'unknown';
}

function resolveProducerToken(env = process.env) {
  if (wantsClassic(env)) {
    const token = env && env.AGENT_GH_TOKEN_CLASSIC;
    if (!token) {
      const err = new Error(
        'AGENT_GH_USE_CLASSIC is set but AGENT_GH_TOKEN_CLASSIC is missing. Refusing to fall back to AGENT_GH_TOKEN.',
      );
      err.status = 400;
      err.code = 'classic-token-missing';
      throw err;
    }
    return { token, source: 'AGENT_GH_TOKEN_CLASSIC' };
  }
  const token = env && env.AGENT_GH_TOKEN;
  if (!token) {
    const err = new Error(
      'Stage C requires AGENT_GH_TOKEN. Conductor and reviewer tokens are refused.',
    );
    err.status = 400;
    err.code = 'producer-token-missing';
    throw err;
  }
  return { token, source: 'AGENT_GH_TOKEN' };
}

module.exports = {
  wantsClassic,
  describeProducerTokenShape,
  resolveProducerToken,
};
