#!/usr/bin/env node
'use strict';

/**
 * Issue-coding loop entry (Stages A–C).
 *
 * USAGE
 *   node coding-loop/run.js --repo org/name --issue 12
 *   node coding-loop/run.js --repo org/name --issue 12 --post
 *   node coding-loop/run.js --repo org/name --issue 12 --implement
 *   node coding-loop/run.js --repo org/name --issue 12 --implement --open-pr
 *
 * --post requires CONDUCTOR_GH_TOKEN or CONDUCTOR_APP_ID+CONDUCTOR_APP_PRIVATE_KEY.
 * --implement / --open-pr require AGENT_GH_TOKEN (or AGENT_GH_TOKEN_CLASSIC
 * when AGENT_GH_USE_CLASSIC=1).
 * --open-pr also requires a writer credential, then opens the PR.
 * Model route (scripts/model-config.js): AI_GW_API_TOKEN (or AI_GW_API_KEY)
 * sends the writer and --live-critic through the NewPush AI gateway, with
 * AI_GW_BASE_URL optional. Without a gateway key the writer needs XAI_API_KEY
 * and --live-critic needs ADC (GCP_ACCESS_TOKEN or gcloud) for Vertex Gemini.
 *
 * Two-step runs (a host that shows the plan before implementing it, such as
 * NoéMi Code's /issue):
 *   --plan-out FILE  write the Stage A/B result after B′ (mode 0600)
 *   --plan-in FILE   skip Stage A/B and implement that accepted plan. Refused
 *                    when the plan was not accepted, names another issue,
 *                    or the issue title/body changed after it was planned.
 *                    Every deterministic Stage A gate (skip, bot, empty,
 *                    entitlement + requester, budget, scan) runs again.
 *
 * Every run needs --requested-by naming a user with write access to the
 * repo (tenant and client alike); without it the issue is REFUSED
 * `trigger-unverified`. Client orgs (not on the tenant's `orgs` list) are
 * entitled only when the conductor App is installed there and
 * NOEMI_CLIENT_REGISTRY has an active row for that account
 * (coding-loop/entitlement.js, Decision [2026-10-22-0005]).
 *
 * GitHub Enterprise Server: GITHUB_API_URL (https only) is honoured for the
 * loop's own GitHub calls.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { gh, githubApiBase } = require('../scripts/github-client.js');
const {
  REQUESTER_REFUSALS, classifyIssue, entitlementGate, issueFromGitHub, labelsOf,
} = require('./intake.js');
const { resolveEntitlement, resolveTrigger } = require('./entitlement.js');
const { completeThroughStageB, critiquePlan, loadRouting } = require('./plan.js');
const { assertProducerToken, openImplementationPr, prepareImplementation } = require('./dispatch.js');
const { resolveProducerToken } = require('../scripts/agent-token.js');
const { critiquePlanLive, revisePlanLive } = require('./critic.js');
const { assertWriterKey, draftChanges } = require('./writer.js');
const { mintGithubAppInstallationToken } = require('../scripts/github-app-token.js');
const { scanIssueBody, scanOutboundText } = require('./scan.js');
const { loadModelConfig } = require('../scripts/model-config.js');
const { prepareReview } = require('./stage-d.js');
const { resolveProfile } = require('./profile.js');

const repoRoot = path.join(__dirname, '..');

const USAGE = 'Usage: coding-loop/run.js --repo owner/name --issue N --requested-by login [--post] [--implement] [--open-pr] [--live-critic] [--profile code|spec] [--tenant path] [--plan-out file | --plan-in file] (--scan | --scan-status APPROVED|BLOCKED|REDACTED) (--budget-ok | --budget-exhausted)\n'
  + 'Omitting both --scan and --scan-status, omitting the budget assertion, or omitting --requested-by classifies the issue as REFUSED (fail closed).\n'
  + '--requested-by names the person who triggered the run; they need write, maintain or admin on the repo. Never the bot.\n'
  + '--scan runs coding-loop/scan.js on the fetched issue; it is not implied by omitting --scan-status.\n'
  + '--profile spec constrains Stage B/C to markdown under agents/, skills/, docs/agents/ (writing personas and skills).\n'
  + '--implement prepares a noemi-agent PR envelope.\n'
  + '--open-pr (with --implement) drafts files via Grok and opens the PR as noemi-agent.\n'
  + '--live-critic runs Gemini Pro for Stage B′ (gateway key, else Vertex ADC); without it B′ is structural only.\n'
  + 'Orgs outside the tenant need the conductor App installed and an active row in NOEMI_CLIENT_REGISTRY.\n'
  + '--plan-out writes the accepted-or-not plan to a file; --plan-in implements that accepted plan without planning again.\n';

/** Flags that take a value, and the args field each one sets. */
const VALUE_FLAGS = {
  '--repo': 'repo',
  '--issue': 'issue',
  '--tenant': 'tenantPath',
  '--requested-by': 'requestedBy',
  '--scan-status': 'scanStatus',
  '--profile': 'profile',
  '--plan-out': 'planOut',
  '--plan-in': 'planIn',
};

// What --scan-status may assert. Anything else is a typo or an error state
// from the caller's scanner, and is refused here AND in the classifier.
const SCAN_STATUS_VALUES = new Set(['APPROVED', 'REDACTED', 'BLOCKED']);
const GITHUB_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\[bot\])?$/;

/** A CLI usage refusal. main() exits 2 for these (status 2). */
function usageError(message) {
  const err = new Error(message);
  err.status = 2;
  return err;
}

function parseArgs(argv) {
  // No permissive defaults: security gates fail CLOSED. A scan status exists
  // only if a scanner produced one (--scan-status, or --scan which runs the
  // local scanner), and budget capacity exists only if the caller checked it
  // — filling either in because the flag was omitted was a critical review
  // finding (fail-open by omission).
  //
  // Throws (status 2) instead of exiting so tests can call it. A value flag
  // whose value is missing or is the next flag is refused: `--requested-by
  // --post` used to set requestedBy to "--post" and swallow the flag.
  const args = {
    post: false,
    implement: false,
    openPr: false,
    liveCritic: false,
    scan: false,
    scanStatus: null,
    budgetState: null,
    profile: 'code',
  };
  const list = Array.isArray(argv) ? argv : [];
  for (let i = 0; i < list.length; i += 1) {
    const flag = String(list[i]);
    if (Object.prototype.hasOwnProperty.call(VALUE_FLAGS, flag)) {
      const value = list[i + 1];
      if (value === undefined || value === null || String(value) === '' || String(value).startsWith('--')) {
        throw usageError(`${flag} needs a value.`);
      }
      i += 1;
      args[VALUE_FLAGS[flag]] = String(value);
      continue;
    }
    switch (flag) {
      case '--post': args.post = true; break;
      case '--implement': args.implement = true; break;
      case '--open-pr': args.openPr = true; break;
      case '--live-critic': args.liveCritic = true; break;
      case '--heuristic-critic': args.liveCritic = false; break;
      case '--scan': args.scan = true; break;
      case '--budget-ok': args.budgetState = 'ok'; break;
      case '--budget-exhausted': args.budgetState = 'exhausted'; break;
      case '--help': args.help = true; break;
      default:
        if (flag.startsWith('--')) throw usageError(`Unknown flag: ${flag}`);
    }
  }
  if (args.requestedBy !== undefined) {
    args.requestedBy = args.requestedBy.replace(/^@/, '');
    if (!GITHUB_LOGIN_RE.test(args.requestedBy)) {
      throw usageError('--requested-by must be a GitHub login.');
    }
  }
  if (args.scanStatus !== null && !SCAN_STATUS_VALUES.has(args.scanStatus)) {
    throw usageError('--scan-status must be exactly APPROVED, REDACTED or BLOCKED.');
  }
  return args;
}
/** owner/name and a positive issue number — refuse anything that would
 *  change the GitHub path (extra slashes, `..`, non-digits). */
function assertRepoIssue(repo, issue) {
  if (typeof repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || repo.includes('..')) {
    const err = new Error('Need --repo owner/name (letters, digits, . _ - only).');
    err.status = 400;
    throw err;
  }
  if (!/^[1-9][0-9]*$/.test(String(issue))) {
    const err = new Error('Need --issue N (positive integer).');
    err.status = 400;
    throw err;
  }
}

/**
 * Translate CLI assertions into classifier inputs. Anything not explicitly
 * asserted is passed as null so classifyIssue's own fail-closed paths fire —
 * the enforcement point is the classifier, never this wrapper.
 */
function buildGateInputs(args) {
  return {
    scan: args.scanStatus ? { status: args.scanStatus } : null,
    budget: args.budgetState ? { exhausted: args.budgetState === 'exhausted' } : null,
  };
}

/**
 * Scan result for classifyIssue. `--scan-status` is a precomputed result.
 * `--scan` runs the local scanner on the fetched issue. Omitting both
 * leaves `null` so the classifier refuses (unscanned-body). This is the
 * function `main()` uses — do not "helpfully" scan when neither flag is set.
 */
function resolveScanInput(args, issue) {
  if (args && args.scanStatus) {
    return { status: args.scanStatus };
  }
  if (args && args.scan) {
    return scanIssueBody(`${(issue && issue.title) || ''}\n${(issue && issue.body) || ''}`);
  }
  return null;
}

function loadTenant(relPath) {
  const file = path.resolve(repoRoot, relPath || 'tenants/internal.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function conductorToken(env = process.env) {
  return (env && env.CONDUCTOR_GH_TOKEN) || '';
}

async function resolveConductorToken(env = process.env, { owner, mint = mintGithubAppInstallationToken } = {}) {
  if (env && env.CONDUCTOR_GH_TOKEN) return env.CONDUCTOR_GH_TOKEN;
  if (env && env.CONDUCTOR_APP_ID && env.CONDUCTOR_APP_PRIVATE_KEY) {
    return mint({
      appId: env.CONDUCTOR_APP_ID,
      privateKey: env.CONDUCTOR_APP_PRIVATE_KEY,
      owner,
      apiBase: githubApiBase(env),
    });
  }
  return '';
}

function readToken(env = process.env) {
  return conductorToken(env)
    || (env && env.GH_TOKEN)
    || (env && env.GITHUB_TOKEN)
    || '';
}

// Reads use the conductor token already resolved above, including an
// installation token minted from the App. --post only controls the comment
// and the label; it must not be required to keep that token (Decision
// [2026-10-03-0002]).
function issueReadToken(conductor, env = process.env) {
  return conductor || readToken(env);
}

const PLAN_FILE_VERSION = 2;

/**
 * What a plan was made from: sha256 over the issue title and body.
 * Version 1 compared `updated_at`, which the conductor's own comment and
 * label bump — so `--plan-out` together with `--post` produced a plan that
 * could never be used. Labels and comments do not change the fingerprint;
 * an edit to the title or body does. `updatedAt` stays in the record as
 * information only.
 */
function issueFingerprint(issue) {
  const title = String((issue && issue.title) || '');
  const body = String((issue && issue.body) || '');
  return crypto.createHash('sha256').update(JSON.stringify([title, body])).digest('hex');
}

/**
 * Write without following a planted symlink and with 0600 from the first
 * byte. writeFileSync's `mode` applies only when it CREATES the file, and it
 * follows a symlink at the target: an existing world-readable file (or a
 * link to one) kept its mode and got the plan. So: refuse a symlink target,
 * write a fresh temp file in the same directory with O_EXCL ('wx') and
 * 0600, then rename it over the target (rename replaces, never follows).
 */
function writeFileAtomic0600(file) {
  return (text) => {
    let stat = null;
    try {
      stat = fs.lstatSync(file);
    } catch (err) {
      if (!err || err.code !== 'ENOENT') throw err;
    }
    if (stat && stat.isSymbolicLink()) {
      const err = new Error('--plan-out refused: the target is a symbolic link.');
      err.status = 409;
      throw err;
    }
    const dir = path.dirname(path.resolve(file));
    const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
      fs.writeFileSync(tmp, text, { flag: 'wx', mode: 0o600 });
      fs.renameSync(tmp, file);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* already gone */ }
      throw err;
    }
  };
}

/** The Stage A/B result a later --plan-in run implements unchanged. */
function writePlanFile(file, {
  repo, issue, updatedAt, fingerprint, profile, intake, plan,
}) {
  const record = {
    version: PLAN_FILE_VERSION,
    repo,
    issue: Number(issue),
    issueFingerprint: fingerprint || null,
    issueUpdatedAt: updatedAt || null,
    profile: profile || 'code',
    intake,
    plan,
  };
  writeFileAtomic0600(file)(`${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/**
 * Read a --plan-out record for this exact issue. The plan is what a person
 * approved; implementing anything else is refused (status 409).
 */
function readPlanFile(file, {
  repo, issue, updatedAt, fingerprint, profile,
}) {
  const refuse = (message) => {
    const err = new Error(`--plan-in refused: ${message}`);
    err.status = 409;
    return err;
  };
  // Never echo the parser's message: a SyntaxError quotes the start of the
  // file, which would print a non-plan file's contents. Name the cause only.
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw refuse(`cannot read the plan file (${(err && err.code) || 'read error'})`);
  }
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    throw refuse('the plan file is not valid JSON');
  }
  if (!record || (record.version !== 1 && record.version !== PLAN_FILE_VERSION)) {
    throw refuse('unknown plan file version');
  }
  if (record.repo !== repo || record.issue !== Number(issue)) {
    throw refuse(`the plan is for ${record.repo}#${record.issue}, not ${repo}#${issue}`);
  }
  if ((record.profile || 'code') !== (profile || 'code')) {
    throw refuse(`the plan used profile ${record.profile}, not ${profile}`);
  }
  if (!record.plan || record.plan.status !== 'accepted') throw refuse('the plan was not accepted');
  const unchanged = record.version === 1
    // Version 1 files carry only updated_at; keep their original check.
    ? Boolean(record.issueUpdatedAt) && record.issueUpdatedAt === updatedAt
    : Boolean(record.issueFingerprint) && record.issueFingerprint === fingerprint;
  if (!unchanged) throw refuse('the issue changed after it was planned; plan it again');
  return { intake: record.intake, plan: record.plan };
}

/**
 * --plan-in skips Stage A, so re-check the entitlement gates the plan was
 * made under: an uninstall, a suspension or a lost write permission between
 * planning and implementing must stop the run (status 403).
 */
function assertStillEntitled({ issue, tenant, entitlement, trigger }) {
  const allowed = entitlementGate({ issue, tenant, entitlement, trigger });
  if (!allowed.ok) {
    const err = new Error(`--plan-in refused: ${allowed.reason}`);
    err.status = 403;
    throw err;
  }
}

/**
 * --plan-in re-runs EVERY deterministic Stage A gate, not only entitlement:
 * a noemi:skip added after planning, an exhausted budget, a body that now
 * fails the scan, or a lost requester must stop implementation. Only the
 * all-gates-passed tier may proceed (status 403 otherwise).
 */
function assertPlanInGates({
  issue, tenant, entitlement, trigger, scan, budget,
}) {
  const gates = classifyIssue({
    issue, tenant, entitlement, trigger, scan, budget,
  });
  if (gates.tier !== 'PENDING_SUFFICIENCY') {
    const err = new Error(`--plan-in refused: ${(gates.reasons || []).join(', ') || gates.tier}`);
    err.status = 403;
    err.intake = gates;
    throw err;
  }
  return gates;
}

/**
 * A plan file is a local file a person may have edited after approving it.
 * It gets the same structural critic (headings, safe paths, carve-outs,
 * profile) and outbound secret scan an accepted plan gets in Stage B′
 * (status 409 otherwise).
 */
function assertPlanInContent(plan, profile) {
  const critique = critiquePlan(plan, { profile });
  if (critique.verdict !== 'pass') {
    const claims = (critique.findings || []).map((f) => f.claim).join(' ');
    const err = new Error(`--plan-in refused: the plan fails the structural critic. ${claims}`.trim());
    err.status = 409;
    throw err;
  }
  const scanned = scanOutboundText(String((plan && plan.plan) || ''));
  if (scanned.status === 'BLOCKED') {
    const err = new Error('--plan-in refused: the plan text fails the secret scan.');
    err.status = 409;
    throw err;
  }
}

/**
 * GitHub follows a renamed or transferred repository's redirect silently.
 * A run asked to work on old-org/name must not act on wherever that now
 * points, so the fetched issue must name the repository we asked for.
 */
function issueRepoOf(payload) {
  const fromApi = /\/repos\/([^/]+)\/([^/]+)\/?$/.exec(String((payload && payload.repository_url) || ''));
  if (fromApi) return `${fromApi[1]}/${fromApi[2]}`;
  const fromHtml = /^https?:\/\/[^/]+\/([^/]+)\/([^/]+)\/(?:issues|pull)\/\d+/.exec(String((payload && payload.html_url) || ''));
  if (fromHtml) return `${fromHtml[1]}/${fromHtml[2]}`;
  return '';
}

function assertIssueInRepo(payload, repo) {
  const actual = issueRepoOf(payload);
  if (!actual || actual.toLowerCase() !== String(repo).toLowerCase()) {
    const err = new Error(`repo-moved: the issue resolved to ${actual || 'an unknown repository'}, not ${repo}. Refusing.`);
    err.status = 409;
    err.reason = 'repo-moved';
    throw err;
  }
}

/**
 * The real integration branch, looked up BEFORE any paid model call.
 * Exact single-ref reads (git/ref, not the prefix-matching git/matching-refs)
 * in preference order; the first that exists wins. A hardcoded list here made
 * every repo look like it had `develop`, so a `dev`-only repo paid for a Grok
 * draft and then failed on the missing base.
 */
async function listIntegrationBranches({ repo, token, ghImpl }) {
  for (const name of ['develop', 'dev']) {
    try {
      const ref = await ghImpl(`/repos/${repo}/git/ref/heads/${name}`, { token });
      if (ref && !Array.isArray(ref) && ref.ref === `refs/heads/${name}`) return [name];
    } catch (err) {
      if (!err || err.status !== 404) throw err;
    }
  }
  return [];
}

async function implementFromPlan({
  args,
  issue,
  plan,
  env = process.env,
  ghImpl = gh,
  token,
  draft = draftChanges,
  open = openImplementationPr,
}) {
  if (!plan || plan.status !== 'accepted') return prepareImplementation({ issue, plan, branches: [] });
  const producer = token || resolveProducerToken(env).token;
  const branches = await listIntegrationBranches({ repo: args.repo, token: producer, ghImpl });
  const prepared = prepareImplementation({ issue, plan, branches });
  if (!args.openPr || prepared.status !== 'ready') return prepared;

  const drafted = await draft({
    issue,
    plan,
    env,
    profile: args.profile,
    repo: args.repo,
    base: prepared.base,
    token: producer,
    // The same apiBase-bound client, so loadBaseFiles reads the base files
    // from the GHES host instead of falling back to api.github.com.
    ghImpl,
  });
  if (drafted.status === 'refused') {
    return {
      ...prepared,
      status: 'refused',
      reason: drafted.reason,
      opened: false,
      writer: 'grok',
      model: drafted.model || null,
    };
  }
  return open({
    repo: args.repo,
    issue,
    plan,
    branches,
    token: producer,
    files: drafted.files,
    model: drafted.model,
    ghImpl,
    env,
  });
}

function conductorComment({ intake, plan }) {
  if (plan.status === 'accepted') return plan.plan;
  if (plan.status === 'needs-info') {
    return ['Plan red-team did not pass:', ...(plan.findings || []).map((f) => `- ${f.claim}`)].join('\n');
  }
  return (intake.questions || []).map((q) => `- ${q}`).join('\n');
}

function requesterRefused(intake) {
  return Boolean(intake) && (intake.reasons || []).some((reason) => REQUESTER_REFUSALS.has(reason));
}

/**
 * Stages A–D with every outside dependency injectable. main() is the CLI
 * wrapper; tests call this directly. Usage refusals throw status 2.
 */
async function runLoop({
  args,
  env = process.env,
  stderr = process.stderr,
  deps = {},
} = {}) {
  if (!args || !args.repo || !args.issue) throw usageError('Need --repo owner/name and --issue N.');
  try {
    assertRepoIssue(args.repo, args.issue);
    resolveProfile(args.profile);
  } catch (err) {
    throw usageError(err.message);
  }
  if (args.openPr && !args.implement) throw usageError('--open-pr requires --implement.');

  const apiBase = githubApiBase(env);
  const call = deps.gh || ((p, opts = {}) => gh(p, { apiBase, ...opts }));
  const repoOwner = String(args.repo).split('/')[0];
  let conductor = '';
  try {
    conductor = await resolveConductorToken(env, { owner: repoOwner, mint: deps.mintToken });
  } catch (err) {
    throw usageError(err.message);
  }
  if (args.post && !conductor) {
    throw usageError('--post requires CONDUCTOR_GH_TOKEN or CONDUCTOR_APP_ID+CONDUCTOR_APP_PRIVATE_KEY. Refusing AGENT_GH_TOKEN / reviewer tokens (identity split).');
  }
  let producer = '';
  if (args.implement) {
    try {
      producer = assertProducerToken(env);
    } catch (err) {
      throw usageError(err.message);
    }
  }
  if (args.openPr) {
    try {
      assertWriterKey(env);
    } catch (err) {
      throw usageError(err.message);
    }
  }
  const token = issueReadToken(conductor, env);
  if (!token) {
    throw usageError('Need a conductor token to read the issue (CONDUCTOR_APP_ID + CONDUCTOR_APP_PRIVATE_KEY, or CONDUCTOR_GH_TOKEN). GH_TOKEN and GITHUB_TOKEN also work for a local read.');
  }

  const tenant = (deps.loadTenant || loadTenant)(args.tenantPath);
  const payload = await call(`/repos/${args.repo}/issues/${args.issue}`, { token });
  assertIssueInRepo(payload, args.repo);
  const issue = issueFromGitHub(args.repo, payload);
  const gateInputs = buildGateInputs(args);
  const scan = resolveScanInput(args, issue);
  const entitlement = await (deps.resolveEntitlement || resolveEntitlement)({
    repo: args.repo, tenant, env, apiBase,
  });
  const trigger = await (deps.resolveTrigger || resolveTrigger)({
    repo: args.repo, login: args.requestedBy, token, ghImpl: call,
  });
  const fingerprint = issueFingerprint(payload);

  let intake;
  let plan;
  if (args.planIn) {
    assertPlanInGates({
      issue, tenant, entitlement, trigger, scan, budget: gateInputs.budget,
    });
    ({ intake, plan } = readPlanFile(args.planIn, {
      repo: args.repo, issue: args.issue, updatedAt: payload.updated_at, fingerprint, profile: args.profile,
    }));
    assertPlanInContent(plan, args.profile);
  } else {
    ({ intake, plan } = await (deps.completeThroughStageB || completeThroughStageB)({
      issue,
      tenant,
      entitlement,
      trigger,
      scan,
      budget: gateInputs.budget,
      routing: loadRouting(repoRoot),
      critic: args.liveCritic ? critiquePlanLive : undefined,
      revise: args.liveCritic
        ? (draftPlan, findings, prompt) => revisePlanLive(draftPlan, findings, { prompt })
        : undefined,
      profile: args.profile,
      repoRoot,
    }));
  }
  if (args.planOut && !args.planIn) {
    writePlanFile(args.planOut, {
      repo: args.repo,
      issue: args.issue,
      updatedAt: payload.updated_at,
      fingerprint,
      profile: args.profile,
      intake,
      plan,
    });
  }

  const risks = [];
  // An outsider (requester refused) leaves no trace: no comment, no label.
  if (args.post && intake.tier !== 'SKIPPED' && !requesterRefused(intake)) {
    const comment = conductorComment({ intake, plan });
    if (comment) {
      const scanned = (deps.scanOutbound || scanOutboundText)(comment);
      if (scanned && scanned.status === 'APPROVED') {
        await call(`/repos/${args.repo}/issues/${args.issue}/comments`, {
          token: conductor,
          method: 'POST',
          body: { body: comment },
        });
      } else {
        // Types only, never the matched text: the audit log carries no secrets.
        const types = ((scanned && scanned.findings) || []).map((f) => f && f.type).filter(Boolean);
        stderr.write(`${JSON.stringify({
          task: 'Conductor comment outbound scan',
          inputs: [`issue=${args.repo}#${args.issue}`],
          actions: ['skip-comment'],
          risks: [`outbound scan ${(scanned && scanned.status) || 'failed'}${types.length ? `: ${types.join(',')}` : ''}`],
          result: 'comment-not-posted',
        })}\n`);
        risks.push('conductor comment withheld: outbound scan blocked it');
      }
    }
  }

  const implementation = args.implement
    ? await (deps.implementFromPlan || implementFromPlan)({
      args, issue, plan, env, ghImpl: call, token: producer, draft: deps.draft, open: deps.open,
    })
    : null;
  const review = prepareReview({ implementation });
  const label = activeLoopLabel({
    post: args.post,
    intake,
    plan,
    implementation,
    review,
  });
  if (label && conductor) {
    await syncNoemiLabel({
      repo: args.repo,
      number: args.issue,
      label,
      current: issue.labels,
      token: conductor,
      ghImpl: call,
    });
  } else if (label) {
    stderr.write('✖ conductor token missing; left the issue label unchanged.\n');
  }

  stderr.write(`${JSON.stringify({
    task: 'Issue-loop Stage A through Stage C',
    inputs: [
      `issue=${args.repo}#${args.issue}`,
      `post=${args.post}`,
      `implement=${args.implement}`,
      `openPr=${args.openPr}`,
      `liveCritic=${args.liveCritic}`,
      `modelRoute=${loadModelConfig(env).mode}`,
      `scan=${args.scanStatus || (args.scan ? 'local' : 'UNSCANNED')}`,
      `profile=${args.profile || 'code'}`,
      `budget=${args.budgetState || 'unverified'}`,
      // The requester's permission, never their login: audit logs carry no PII (AGENTS.md).
      `requester=${trigger ? (trigger.error ? 'unverified' : trigger.permission) : 'none'}`,
    ],
    actions: [intake.tier, plan.status, implementation && implementation.status, ...(intake.reasons || [])].filter(Boolean),
    risks: [
      ...risks,
      intake.mode === 'heuristic' ? 'sufficiency is heuristic until the Stage A model is wired' : null,
      plan.mode === 'heuristic' && plan.status === 'accepted' ? 'Stage B′ used the structural critic; pass --live-critic for Gemini' : null,
      plan.status === 'needs-info'
        ? (Number.isInteger(plan.maxCycles) && plan.cycles < plan.maxCycles
          ? 'Stage B′ stopped because the plan was not revised'
          : 'Stage B′ hit the cycle limit')
        : null,
      implementation && implementation.status === 'ready' && implementation.opened !== true
        ? 'Stage C envelope ready; pass --open-pr to draft with Grok and open as noemi-agent'
        : null,
    ].filter(Boolean),
    result: label || plan.label || intake.label,
  })}\n`);
  return {
    intake, plan, implementation, review,
  };
}

async function main(argv = process.argv.slice(2), {
  env = process.env, stdout = process.stdout, stderr = process.stderr, deps,
} = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    stdout.write(USAGE);
    return 0;
  }
  const result = await runLoop({
    args, env, stderr, deps,
  });
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

function activeLoopLabel({
  post, intake, plan, implementation, review,
} = {}) {
  if (implementation && implementation.opened) {
    if (review && review.status === 'delegated' && review.label) return review.label;
    return implementation.label || '';
  }
  if (!post || !intake || intake.tier === 'SKIPPED') return '';
  // A run nobody entitled to ask for must not touch the issue at all.
  if (requesterRefused(intake)) return '';
  if (plan && (plan.status === 'accepted' || plan.status === 'needs-info')) return plan.label || '';
  return intake.label || '';
}

/**
 * Add the new loop label FIRST, then remove the stale ones. If a call fails
 * part-way the issue still carries the current state (plus a stale label the
 * next sync removes), never no loop label at all. Both calls are safe to
 * repeat (adding a present label is a no-op; a repeated DELETE is a 404,
 * ignored), so they opt in to retry on 5xx.
 */
async function syncNoemiLabel({
  repo, number, label, current, token, ghImpl,
} = {}) {
  const call = ghImpl || gh;
  const names = labelsOf({ labels: current });
  if (label && !names.includes(label)) {
    await call(`/repos/${repo}/issues/${number}/labels`, {
      token,
      method: 'POST',
      idempotent: true,
      body: { labels: [label] },
    });
  }
  for (const name of names) {
    if (!name.startsWith('noemi:') || name === label) continue;
    const encoded = encodeURIComponent(name);
    try {
      await call(`/repos/${repo}/issues/${number}/labels/${encoded}`, { token, method: 'DELETE', idempotent: true });
    } catch (err) {
      if (!err || err.status !== 404) throw err;
    }
  }
}

function exitCodeForError(err) {
  if (err && err.status === 2) return 2;
  return err && Number.isInteger(err.status) && err.status >= 500 ? 2 : 1;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write(`✖ ${err.message}\n`);
    process.exit(exitCodeForError(err));
  });
}

module.exports = {
  PLAN_FILE_VERSION,
  USAGE,
  activeLoopLabel,
  assertIssueInRepo,
  assertPlanInContent,
  assertPlanInGates,
  assertRepoIssue,
  assertStillEntitled,
  buildGateInputs,
  exitCodeForError,
  implementFromPlan,
  issueFingerprint,
  issueReadToken,
  issueRepoOf,
  listIntegrationBranches,
  loadTenant,
  main,
  parseArgs,
  readPlanFile,
  resolveConductorToken,
  resolveScanInput,
  runLoop,
  syncNoemiLabel,
  writePlanFile,
};
