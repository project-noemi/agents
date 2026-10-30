'use strict';

/**
 * Stage C (skills/orchestration/dispatch-coordinate.md, producer half).
 *
 * Prepares a noemi-agent pull-request envelope from an accepted Stage B′
 * plan. Opening requires AGENT_GH_TOKEN (or AGENT_GH_TOKEN_CLASSIC when
 * AGENT_GH_USE_CLASSIC=1) and explicit --open-pr; the
 * conductor and reviewer tokens are refused. Never targets main when
 * develop/dev exist (Decision [2026-08-16-0003]). Never approves or merges.
 */

const { pickIntegrationBranch } = require('../scripts/deploy-ai-review-lib.js');
const { gh } = require('../scripts/github-client.js');
const { resolveProducerToken } = require('../scripts/agent-token.js');
const { encodeRepoPath, isCarvedOut, isSafeRepoPath } = require('./paths.js');
const { neutralizeForgeRefs } = require('./prompt-data.js');
const { scanOutboundText } = require('./scan.js');

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
  // Issue title and plan text are issue- or model-derived. Posted raw, a
  // `Fixes #7` inside them would close ANOTHER issue on merge and `@user`
  // would page someone. neutralizeForgeRefs puts both in code spans, so the
  // loop's own link line below is the only closing keyword in the body.
  const rawTitle = String((issue && issue.title) || 'issue ' + number).slice(0, 60);
  const title = `feat: ${neutralizeForgeRefs(rawTitle)}`;
  return {
    status: 'ready',
    reason: 'not-opened',
    opened: false,
    identity: 'noemi-agent',
    writer: 'grok',
    base,
    head: `noemi/issue-${number}`,
    title,
    body: [issueLinkLine(number, plan), '', neutralizeForgeRefs(plan.plan || '')].join('\n'),
    label: 'noemi:in-progress',
  };
}

function issueLinkLine(number, plan) {
  // "Closes" merges the issue away. A plan that says the agent does not
  // finish the work must leave the issue open for that human step
  // (Decision [2026-10-05-0001]).
  const text = String((plan && plan.plan) || '');
  const keyword = /the agent does not\b/i.test(text) ? 'Part of' : 'Closes';
  return `${keyword} #${number}`;
}

function assertProducerToken(env) {
  return resolveProducerToken(env).token;
}

/**
 * First bad path in a writer change set, or null. Checked before ANY network
 * call. isSafeRepoPath is an allow-list on the path as written (so
 * `%2e%2e/contents/.github/workflows/ci.yml` is refused, not decoded);
 * isCarvedOut catches governance and CI files that are well-formed.
 */
function badWriterPath(files) {
  for (const file of files) {
    const filePath = file && file.path;
    if (!isSafeRepoPath(filePath)) return { reason: 'writer-bad-path' };
    if (isCarvedOut(filePath)) return { reason: 'writer-carve-out' };
    if (typeof file.content !== 'string') return { reason: 'writer-bad-path' };
  }
  return null;
}

/** `refs/heads/<name>` as a URL path: each segment encoded, slashes kept. */
function refPath(branch) {
  return encodeRepoPath(String(branch));
}

async function treeShaOfCommit(call, repo, sha, token) {
  const commit = await call(`/repos/${repo}/git/commits/${encodeURIComponent(sha)}`, { token });
  return commit && commit.tree && commit.tree.sha;
}

/**
 * Open the implementation PR as ONE commit, created atomically.
 *
 * The old path wrote one contents PUT per file onto a branch it created
 * first. A failure mid-way left an orphan `noemi/issue-N` branch and every
 * later run refused `head-exists` forever. Git Data API objects (blobs via
 * tree content, trees, commits) are invisible until a ref points at them,
 * so the branch ref is created LAST: either the whole change is visible, or
 * nothing is.
 *
 * Resume: a 422 on ref creation means the branch already exists. When its
 * commit has the same tree as ours, an earlier run already got this far
 * (e.g. its PR call failed), so continue. A 422 on PR creation means a PR
 * for this head exists; return it instead of failing.
 *
 * `idempotent: true` on the writes below is deliberate: trees and commits
 * are content-addressed (a repeat only makes an unreferenced object), and
 * the ref/PR creates resolve their own 422 as above. Comments and labels
 * elsewhere are NOT idempotent and keep the default no-retry-on-5xx.
 */
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
  scanImpl = scanOutboundText,
  stderr = process.stderr,
} = {}) {
  assertProducerToken({ AGENT_GH_TOKEN: token });
  const prepared = prepareImplementation({ issue, plan, branches });
  if (prepared.status !== 'ready') return prepared;

  if (!Array.isArray(files) || files.length === 0) {
    return { ...prepared, status: 'refused', reason: 'writer-empty', opened: false };
  }
  const badPath = badWriterPath(files);
  if (badPath) {
    return { ...prepared, status: 'refused', reason: badPath.reason, opened: false };
  }

  if (typeof repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || repo.includes('..')) {
    const err = new Error('Stage C open requires owner/name.');
    err.status = 400;
    throw err;
  }

  // Outbound scan of what the PR will publish, before anything is written.
  const scanned = scanImpl(`${prepared.title}\n${prepared.body}`);
  if (!scanned || scanned.status !== 'APPROVED') {
    stderr.write(`${JSON.stringify({
      task: 'Stage C open PR',
      inputs: [`repo=${repo}`, `issue=${slugIssue(issue)}`],
      actions: ['outbound-scan'],
      risks: ['PR title/body matched a credential or PII pattern; nothing was pushed'],
      result: 'pr-body-blocked',
    })}\n`);
    return { ...prepared, status: 'refused', reason: 'pr-body-blocked', opened: false };
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

  const ref = await call(`/repos/${repo}/git/ref/heads/${refPath(prepared.base)}`, { token });
  const baseSha = ref && ref.object && ref.object.sha;
  if (!baseSha) {
    return { ...prepared, status: 'refused', reason: 'missing-base-sha', opened: false };
  }
  const baseTree = await treeShaOfCommit(call, repo, baseSha, token);
  if (!baseTree) {
    return { ...prepared, status: 'refused', reason: 'missing-base-sha', opened: false };
  }

  const tree = await call(`/repos/${repo}/git/trees`, {
    token,
    method: 'POST',
    idempotent: true,
    body: {
      base_tree: baseTree,
      tree: files.map((file) => ({
        path: file.path, mode: '100644', type: 'blob', content: file.content,
      })),
    },
  });
  const treeSha = tree && tree.sha;
  if (!treeSha) {
    const err = new Error('Stage C: GitHub returned no tree sha.');
    err.status = 502;
    throw err;
  }

  const commit = await call(`/repos/${repo}/git/commits`, {
    token,
    method: 'POST',
    idempotent: true,
    body: {
      // No closing keyword: a commit message that says "Closes #N" closes
      // the issue when it reaches the default branch, bypassing the PR body.
      message: `feat: noemi-agent changes for issue ${slugIssue(issue)}`,
      tree: treeSha,
      parents: [baseSha],
    },
  });
  const commitSha = commit && commit.sha;
  if (!commitSha) {
    const err = new Error('Stage C: GitHub returned no commit sha.');
    err.status = 502;
    throw err;
  }

  let resumed = false;
  try {
    await call(`/repos/${repo}/git/refs`, {
      token,
      method: 'POST',
      idempotent: true,
      body: { ref: `refs/heads/${prepared.head}`, sha: commitSha },
    });
  } catch (err) {
    if (!err || err.status !== 422) throw err;
    let existingTree = null;
    try {
      const existing = await call(`/repos/${repo}/git/ref/heads/${refPath(prepared.head)}`, { token });
      const existingSha = existing && existing.object && existing.object.sha;
      existingTree = existingSha ? await treeShaOfCommit(call, repo, existingSha, token) : null;
    } catch (lookupErr) {
      if (!lookupErr || lookupErr.status !== 404) throw lookupErr;
    }
    if (!existingTree || existingTree !== treeSha) {
      return { ...prepared, status: 'refused', reason: 'head-exists', opened: false };
    }
    resumed = true;
  }

  let pr;
  try {
    pr = await call(`/repos/${repo}/pulls`, {
      token,
      method: 'POST',
      idempotent: true,
      body: {
        title: prepared.title,
        head: prepared.head,
        base: prepared.base,
        body: prepared.body,
      },
    });
  } catch (err) {
    if (!err || err.status !== 422) throw err;
    const owner = repo.split('/')[0];
    const open = await call(
      `/repos/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${prepared.head}`)}`,
      { token },
    );
    pr = Array.isArray(open) ? open[0] : null;
    if (!pr) throw err;
    resumed = true;
  }

  return {
    ...prepared,
    status: 'ready',
    reason: 'opened',
    opened: true,
    resumed,
    writer: 'grok',
    url: pr && pr.html_url,
    number: pr && pr.number,
    model: model || null,
    label: 'noemi:in-progress',
  };
}

module.exports = {
  assertProducerToken,
  badWriterPath,
  expectedProducerLogin,
  issueLinkLine,
  openImplementationPr,
  prepareImplementation,
  slugIssue,
};
