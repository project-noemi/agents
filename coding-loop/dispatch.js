'use strict';

/**
 * Stage C (skills/orchestration/dispatch-coordinate.md, producer half).
 *
 * Prepares a noemi-agent pull-request envelope from an accepted Stage B′
 * plan. Opening requires AGENT_GH_TOKEN and explicit --open-pr; the
 * conductor and reviewer tokens are refused. Never targets main when
 * develop/dev exist (Decision [2026-08-16-0003]). Never approves or merges.
 */

const { pickIntegrationBranch } = require('../scripts/deploy-ai-review-lib.js');
const { gh } = require('../scripts/github-client.js');
const { isCarvedOut } = require('./writer.js');

function slugIssue(issue) {
  const n = issue && issue.number;
  return Number.isInteger(n) || /^[1-9][0-9]*$/.test(String(n)) ? String(n) : '0';
}

function expectedProducerLogin(env = process.env) {
  return (env && env.AGENT_GH_EXPECTED_LOGIN) || 'noemi-agent';
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
    reason: 'not-opened',
    opened: false,
    identity: 'noemi-agent',
    writer: 'grok',
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

async function openImplementationPr({
  repo,
  issue,
  plan,
  branches,
  token,
  files,
  ghImpl,
  env = process.env,
  model,
} = {}) {
  assertProducerToken({ AGENT_GH_TOKEN: token });
  const prepared = prepareImplementation({ issue, plan, branches });
  if (prepared.status !== 'ready') return prepared;

  if (!Array.isArray(files) || files.length === 0) {
    return { ...prepared, status: 'refused', reason: 'writer-empty', opened: false };
  }
  if (files.some((file) => isCarvedOut(file && file.path))) {
    return { ...prepared, status: 'refused', reason: 'writer-carve-out', opened: false };
  }

  if (typeof repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    const err = new Error('Stage C open requires owner/name.');
    err.status = 400;
    throw err;
  }

  const call = ghImpl || gh;
  const actor = await call('/user', { token });
  const expected = expectedProducerLogin(env);
  if (!actor || actor.login !== expected) {
    const err = new Error(
      `Stage C token is ${actor && actor.login ? actor.login : 'unknown'}, not ${expected}.`,
    );
    err.status = 403;
    throw err;
  }

  const ref = await call(`/repos/${repo}/git/ref/heads/${prepared.base}`, { token });
  const baseSha = ref && ref.object && ref.object.sha;
  if (!baseSha) {
    return { ...prepared, status: 'refused', reason: 'missing-base-sha', opened: false };
  }

  try {
    await call(`/repos/${repo}/git/refs`, {
      token,
      method: 'POST',
      body: { ref: `refs/heads/${prepared.head}`, sha: baseSha },
    });
  } catch (err) {
    if (err && err.status === 422) {
      return { ...prepared, status: 'refused', reason: 'head-exists', opened: false };
    }
    throw err;
  }

  for (const file of files) {
    let sha;
    try {
      const existing = await call(
        `/repos/${repo}/contents/${file.path}?ref=${encodeURIComponent(prepared.head)}`,
        { token },
      );
      sha = existing && existing.sha;
    } catch (err) {
      if (!err || err.status !== 404) throw err;
    }
    await call(`/repos/${repo}/contents/${file.path}`, {
      token,
      method: 'PUT',
      body: {
        message: `feat: ${file.path} for #${slugIssue(issue)}`,
        content: Buffer.from(file.content, 'utf8').toString('base64'),
        branch: prepared.head,
        ...(sha ? { sha } : {}),
      },
    });
  }

  const pr = await call(`/repos/${repo}/pulls`, {
    token,
    method: 'POST',
    body: {
      title: prepared.title,
      head: prepared.head,
      base: prepared.base,
      body: prepared.body,
    },
  });

  return {
    ...prepared,
    status: 'ready',
    reason: 'opened',
    opened: true,
    writer: 'grok',
    url: pr && pr.html_url,
    number: pr && pr.number,
    model: model || null,
    label: 'noemi:in-progress',
  };
}

module.exports = {
  assertProducerToken,
  expectedProducerLogin,
  openImplementationPr,
  prepareImplementation,
  slugIssue,
};
