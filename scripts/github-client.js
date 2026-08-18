'use strict';

/**
 * Shared GitHub REST helper with the fleet retry contract
 * (Decision [2026-08-17-0002]).
 *
 * Retry classification keys on the structured `status` property, never on
 * the message text (the body can quote attacker-influencable input).
 */

const { withRetry } = require('./resilience_helpers.js');

const GH_API = 'https://api.github.com';

function isTransientGitHubError(err) {
  if (err && Number.isInteger(err.status)) {
    return err.status === 429 || (err.status >= 500 && err.status < 600);
  }
  return Boolean(err) && err.name === 'TypeError';
}

async function gh(path, { token, accept = 'application/vnd.github+json', method = 'GET', body } = {}) {
  return withRetry(async () => {
    const res = await fetch(`${GH_API}${path}`, {
      method,
      headers: {
        Accept: accept,
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const error = new Error(`GitHub ${method} ${path} → ${res.status} ${await res.text()}`);
      error.status = res.status;
      throw error;
    }
    return accept.includes('diff') ? res.text() : res.json();
  }, {
    maxRetries: 4,
    baseDelayMs: Number(process.env.GITHUB_RETRY_BASE_MS || process.env.REVIEW_RETRY_BASE_MS || 2000),
    maxDelayMs: 20000,
    retryIf: isTransientGitHubError,
  });
}

module.exports = {
  GH_API,
  gh,
  isTransientGitHubError,
};
