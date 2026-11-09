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
const { resolveProducerToken } = require('../scripts/agent-token.js');
const { isCarvedOut, isSafeRepoPath } = require('./paths.js');
const { neutralizeForgeRefs } = require('./prompt-data.js');
const { scanOutboundText } = require('./scan.js');
const {
  createGithubProvider, githubCredential, provider: defaultGithub,
} = require('./providers/github/index.js');

function slugIssue(issue) {
  const n = issue && issue.number;
  return Number.isInteger(n) || /^[1-9][0-9]*$/.test(String(n)) ? String(n) : '0';
}

function expectedProducerLogin(env = process.env) {
  return defaultGithub.expectedProducerLogin(env);
}

/**
 * `provider` shapes the head branch and the link line; it defaults to
 * GitHub so callers written before the provider seam are unchanged.
 */
function prepareImplementation({
  issue, plan, branches, provider = defaultGithub,
} = {}) {
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
    head: provider.branchForItem(number),
    title,
    body: [issueLinkLine(number, plan, provider), '', neutralizeForgeRefs(plan.plan || '')].join('\n'),
    label: 'noemi:in-progress',
  };
}

function issueLinkLine(number, plan, provider = defaultGithub) {
  // "Closes" merges the issue away. A plan that says the agent does not
  // finish the work must leave the issue open for that human step
  // (Decision [2026-10-05-0001]).
  const text = String((plan && plan.plan) || '');
  return provider.closingLine(number, { closes: !/the agent does not\b/i.test(text) });
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

function identitySplitError(message) {
  const err = new Error(`identity-split: ${message}`);
  err.status = 403;
  err.code = 'identity-split';
  err.reason = 'identity-split';
  return err;
}

/**
 * Runtime identity split, before the first producer write: the conductor
 * credential (when the run has one) must resolve to a DIFFERENT identity
 * than the producer. The static checks in resolveCredential compare secrets
 * and configured ids; this compares what the forge says each one IS, so the
 * same principal reached through two credential forms (a client secret and
 * a pre-minted token, two PATs of one user) is still refused. A conductor
 * the forge reports as an App installation (GitHub) is never a user, so it
 * cannot be the producer. A conductor lookup failure refuses (fail closed).
 */
async function assertIdentitySplit({
  forge, target, actor, conductor,
}) {
  if (!conductor) return;
  let other;
  try {
    other = await forge.whoAmI(target, conductor);
  } catch (err) {
    throw identitySplitError(`the conductor identity could not be read (${(err && err.status) || 'error'}); refusing producer writes.`);
  }
  if (other && other.appInstallation === true) return;
  const key = (who, field) => (who && who[field] !== undefined && who[field] !== null && who[field] !== ''
    ? String(who[field]).toLowerCase() : null);
  const otherId = key(other, 'id');
  const otherLogin = key(other, 'login');
  if (!otherId && !otherLogin) throw identitySplitError('the conductor identity is unknown; refusing producer writes.');
  const same = (otherId && otherId === key(actor, 'id')) || (otherLogin && otherLogin === key(actor, 'login'));
  if (same) throw identitySplitError('the conductor and producer credentials are the same identity; refusing producer writes.');
}

/**
 * Open the implementation change request as ONE commit, created atomically
 * (provider.commitFiles: nothing is visible until the whole change is; the
 * branch is created last). A rerun resumes a branch that already holds the
 * same tree; a different tree is `head-exists` and is never overwritten. An
 * already-open change request for the head is returned, not duplicated.
 *
 * Forge-neutral: every forge call goes through `provider`. Callers from
 * before the seam pass `repo` (owner/name), `token` and `ghImpl`; those
 * build the GitHub provider exactly as before. `ref` + `cred` + `provider`
 * is the provider-native form.
 */
async function openImplementationPr({
  repo,
  ref,
  provider,
  issue,
  plan,
  branches,
  token,
  cred,
  conductorCred,
  files,
  ghImpl,
  env = process.env,
  model,
  scanImpl = scanOutboundText,
  stderr = process.stderr,
} = {}) {
  const forge = provider || createGithubProvider({ gh: ghImpl });
  if (!cred) assertProducerToken({ AGENT_GH_TOKEN: token });
  const prepared = prepareImplementation({
    issue, plan, branches, provider: forge,
  });
  if (prepared.status !== 'ready') return prepared;

  if (!Array.isArray(files) || files.length === 0) {
    return { ...prepared, status: 'refused', reason: 'writer-empty', opened: false };
  }
  const badPath = badWriterPath(files);
  if (badPath) {
    return { ...prepared, status: 'refused', reason: badPath.reason, opened: false };
  }

  const target = ref || (typeof repo === 'string' ? forge.parseRepo(repo, { env }) : null);
  if (!target) {
    const err = new Error('Stage C open requires owner/name.');
    err.status = 400;
    throw err;
  }
  const display = target.slug;
  const producer = cred || githubCredential(token, { role: 'producer', source: 'token' });

  // Outbound scan of what the PR will publish, before anything is written.
  const scanned = scanImpl(`${prepared.title}\n${prepared.body}`);
  if (!scanned || scanned.status !== 'APPROVED') {
    stderr.write(`${JSON.stringify({
      task: 'Stage C open PR',
      inputs: [`repo=${display}`, `issue=${slugIssue(issue)}`, `provider=${forge.id}`],
      actions: ['outbound-scan'],
      risks: ['PR title/body matched a credential or PII pattern; nothing was pushed'],
      result: 'pr-body-blocked',
    })}\n`);
    return { ...prepared, status: 'refused', reason: 'pr-body-blocked', opened: false };
  }

  const actor = await forge.whoAmI(target, producer);
  const expected = forge.expectedProducerLogin(env);
  if (!actor || actor.login !== expected) {
    const err = new Error(
      `Stage C token is ${actor && actor.login ? actor.login : 'unknown'}, not ${expected}.`,
    );
    err.status = 403;
    throw err;
  }
  await assertIdentitySplit({
    forge, target, actor, conductor: conductorCred,
  });

  const committed = await forge.commitFiles(target, {
    base: prepared.base,
    head: prepared.head,
    files,
    // No closing keyword: a commit message that says "Closes #N" closes
    // the issue when it reaches the default branch, bypassing the PR body.
    message: `feat: noemi-agent changes for issue ${slugIssue(issue)}`,
  }, producer);
  if (committed.status === 'missing-base') {
    return { ...prepared, status: 'refused', reason: 'missing-base-sha', opened: false };
  }
  if (committed.status === 'head-exists') {
    return { ...prepared, status: 'refused', reason: 'head-exists', opened: false };
  }
  if (committed.status === 'refused') {
    // The forge cannot make this change safely (e.g. Azure DevOps cannot
    // keep an executable bit). Nothing was written.
    return { ...prepared, status: 'refused', reason: committed.reason || 'commit-refused', opened: false };
  }
  if (committed.status !== 'created' && committed.status !== 'resumed') {
    const err = new Error(`Stage C: unknown commit status from ${forge.id}.`);
    err.status = 502;
    throw err;
  }

  const cr = await forge.openChangeRequest(target, {
    base: prepared.base,
    head: prepared.head,
    title: prepared.title,
    body: prepared.body,
    itemId: slugIssue(issue),
  }, producer);

  return {
    ...prepared,
    status: 'ready',
    reason: 'opened',
    opened: true,
    resumed: committed.status === 'resumed' || cr.existing === true,
    writer: 'grok',
    url: cr.url,
    number: cr.number,
    model: model || null,
    label: 'noemi:in-progress',
    ...(cr.autoCompleteCleared ? { autoCompleteCleared: true } : {}),
    ...(cr.descriptionTruncated ? { descriptionTruncated: true } : {}),
  };
}

module.exports = {
  assertIdentitySplit,
  assertProducerToken,
  badWriterPath,
  expectedProducerLogin,
  issueLinkLine,
  openImplementationPr,
  prepareImplementation,
  slugIssue,
};
