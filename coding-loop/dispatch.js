'use strict';

/**
 * Stage C (skills/orchestration/dispatch-coordinate.md, producer half).
 *
 * Prepares a noemi-agent pull-request envelope from an accepted Stage B′
 * plan. Does not write code (Grok is not wired). Does not open a PR from
 * this module — opening is a host act that must use AGENT_GH_TOKEN, never
 * the conductor or reviewer. Never targets main when develop/dev exist
 * (Decision [2026-08-16-0003]).
 */

const { pickIntegrationBranch } = require('../scripts/deploy-ai-review-lib.js');

function slugIssue(issue) {
  const n = issue && issue.number;
  return Number.isInteger(n) || /^[1-9][0-9]*$/.test(String(n)) ? String(n) : '0';
}

function prepareImplementation({ issue, plan, branches } = {}) {
  if (!plan || plan.status !== 'accepted') {
    return {
      status: 'refused',
      reason: 'plan-not-accepted',
      opened: false,
      identity: 'noemi-agent',
    };
  }

  const base = pickIntegrationBranch(Array.isArray(branches) ? branches : []);
  if (!base) {
    return {
      status: 'refused',
      reason: 'no-integration-branch',
      opened: false,
      identity: 'noemi-agent',
    };
  }

  const number = slugIssue(issue);
  const title = `feat: ${String((issue && issue.title) || 'issue ' + number).slice(0, 60)}`;
  return {
    status: 'ready',
    reason: 'writer-unwired',
    opened: false,
    identity: 'noemi-agent',
    writer: 'unwired',
    base,
    head: `noemi/issue-${number}`,
    title,
    body: [`Closes #${number}`, '', plan.plan || ''].join('\n'),
    label: 'noemi:in-progress',
  };
}

function assertProducerToken(env) {
  const agent = env && env.AGENT_GH_TOKEN;
  if (!agent) {
    const err = new Error('Stage C requires AGENT_GH_TOKEN. Conductor and reviewer tokens are refused.');
    err.status = 400;
    throw err;
  }
  return agent;
}

module.exports = {
  assertProducerToken,
  prepareImplementation,
  slugIssue,
};
