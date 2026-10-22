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
 *                    or the issue changed on GitHub after it was planned.
 *
 * Client orgs (not on the tenant's `orgs` list) are entitled only when the
 * conductor App is installed there and NOEMI_CLIENT_REGISTRY has an active
 * row for that account, and --requested-by names a user with write access
 * (coding-loop/entitlement.js, Decision [2026-10-22-0005]). Both are checked
 * again on --plan-in, so an uninstall or suspension stops implementation.
 */

const fs = require('fs');
const path = require('path');
const { gh } = require('../scripts/github-client.js');
const { entitlementGate, issueFromGitHub, labelsOf } = require('./intake.js');
const { resolveEntitlement, resolveTrigger } = require('./entitlement.js');
const { completeThroughStageB, loadRouting } = require('./plan.js');
const { assertProducerToken, openImplementationPr, prepareImplementation } = require('./dispatch.js');
const { resolveProducerToken } = require('../scripts/agent-token.js');
const { critiquePlanLive, revisePlanLive } = require('./critic.js');
const { assertWriterKey, draftChanges } = require('./writer.js');
const { mintGithubAppInstallationToken } = require('../scripts/github-app-token.js');
const { scanIssueBody } = require('./scan.js');
const { loadModelConfig } = require('../scripts/model-config.js');
const { prepareReview } = require('./stage-d.js');
const { resolveProfile } = require('./profile.js');

const repoRoot = path.join(__dirname, '..');

function parseArgs(argv) {
  // No permissive defaults: security gates fail CLOSED. A scan status exists
  // only if a scanner produced one (--scan-status, or --scan which runs the
  // local scanner), and budget capacity exists only if the caller checked it
  // — filling either in because the flag was omitted was a critical review
  // finding (fail-open by omission).
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
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--repo': args.repo = argv[++i]; break;
      case '--issue': args.issue = argv[++i]; break;
      case '--post': args.post = true; break;
      case '--implement': args.implement = true; break;
      case '--open-pr': args.openPr = true; break;
      case '--live-critic': args.liveCritic = true; break;
      case '--heuristic-critic': args.liveCritic = false; break;
      case '--tenant': args.tenantPath = argv[++i]; break;
      case '--requested-by': args.requestedBy = String(argv[++i] || '').replace(/^@/, ''); break;
      case '--scan': args.scan = true; break;
      case '--scan-status': args.scanStatus = argv[++i]; break;
      case '--budget-ok': args.budgetState = 'ok'; break;
      case '--budget-exhausted': args.budgetState = 'exhausted'; break;
      case '--profile': args.profile = argv[++i]; break;
      case '--plan-out': args.planOut = argv[++i]; break;
      case '--plan-in': args.planIn = argv[++i]; break;
      case '--help':
        process.stdout.write('Usage: coding-loop/run.js --repo owner/name --issue N [--post] [--implement] [--open-pr] [--live-critic] [--profile code|spec] [--tenant path] [--requested-by login] [--plan-out file | --plan-in file] (--scan | --scan-status APPROVED|BLOCKED|REDACTED) (--budget-ok | --budget-exhausted)\n'
          + 'Omitting both --scan and --scan-status, or omitting the budget assertion, classifies the issue as REFUSED (fail closed).\n'
          + '--scan runs coding-loop/scan.js on the fetched issue; it is not implied by omitting --scan-status.\n'
          + '--profile spec constrains Stage B/C to markdown under agents/, skills/, docs/agents/ (writing personas and skills).\n'
          + '--implement prepares a noemi-agent PR envelope.\n'
          + '--open-pr (with --implement) drafts files via Grok and opens the PR as noemi-agent.\n'
          + '--live-critic runs Gemini Pro for Stage B′ (gateway key, else Vertex ADC); without it B′ is structural only.\n'
          + 'Orgs outside the tenant need the conductor App installed and an active row in NOEMI_CLIENT_REGISTRY, plus --requested-by a user with write access.\n'
          + '--plan-out writes the accepted-or-not plan to a file; --plan-in implements that accepted plan without planning again.\n');
        process.exit(0);
        break;
      default:
        if (String(argv[i]).startsWith('--')) {
          process.stderr.write(`Unknown flag: ${argv[i]}\n`);
          process.exit(2);
        }
    }
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

async function resolveConductorToken(env = process.env, { owner } = {}) {
  if (env && env.CONDUCTOR_GH_TOKEN) return env.CONDUCTOR_GH_TOKEN;
  if (env && env.CONDUCTOR_APP_ID && env.CONDUCTOR_APP_PRIVATE_KEY) {
    return mintGithubAppInstallationToken({
      appId: env.CONDUCTOR_APP_ID,
      privateKey: env.CONDUCTOR_APP_PRIVATE_KEY,
      owner,
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

const PLAN_FILE_VERSION = 1;

/** The Stage A/B result a later --plan-in run implements unchanged. */
function writePlanFile(file, { repo, issue, updatedAt, profile, intake, plan }) {
  const record = {
    version: PLAN_FILE_VERSION,
    repo,
    issue: Number(issue),
    issueUpdatedAt: updatedAt || null,
    profile: profile || 'code',
    intake,
    plan,
  };
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  return record;
}

/**
 * Read a --plan-out record for this exact issue. The plan is what a person
 * approved; implementing anything else is refused (status 409).
 */
function readPlanFile(file, { repo, issue, updatedAt, profile }) {
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
  if (!record || record.version !== PLAN_FILE_VERSION) throw refuse('unknown plan file version');
  if (record.repo !== repo || record.issue !== Number(issue)) {
    throw refuse(`the plan is for ${record.repo}#${record.issue}, not ${repo}#${issue}`);
  }
  if ((record.profile || 'code') !== (profile || 'code')) {
    throw refuse(`the plan used profile ${record.profile}, not ${profile}`);
  }
  if (!record.plan || record.plan.status !== 'accepted') throw refuse('the plan was not accepted');
  if (!record.issueUpdatedAt || record.issueUpdatedAt !== updatedAt) {
    throw refuse('the issue changed after it was planned; plan it again');
  }
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

async function implementFromPlan({ args, issue, plan }) {
  const branches = ['develop', 'dev', 'main'];
  const prepared = prepareImplementation({ issue, plan, branches });
  if (!args.openPr || prepared.status !== 'ready') return prepared;

  const drafted = await draftChanges({
    issue,
    plan,
    env: process.env,
    profile: args.profile,
    repo: args.repo,
    base: prepared.base,
    token: resolveProducerToken(process.env).token,
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
  return openImplementationPr({
    repo: args.repo,
    issue,
    plan,
    branches,
    token: resolveProducerToken(process.env).token,
    files: drafted.files,
    model: drafted.model,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.repo || !args.issue) {
    process.stderr.write('✖ Need --repo owner/name and --issue N.\n');
    process.exit(2);
  }
  try {
    assertRepoIssue(args.repo, args.issue);
    resolveProfile(args.profile);
  } catch (err) {
    process.stderr.write(`✖ ${err.message}\n`);
    process.exit(2);
  }

  if (args.openPr && !args.implement) {
    process.stderr.write('✖ --open-pr requires --implement.\n');
    process.exit(2);
  }

  const repoOwner = String(args.repo).split('/')[0];
  let conductor = '';
  try {
    conductor = await resolveConductorToken(process.env, { owner: repoOwner });
  } catch (err) {
    process.stderr.write(`✖ ${err.message}\n`);
    process.exit(2);
  }
  if (args.post && !conductor) {
    process.stderr.write('✖ --post requires CONDUCTOR_GH_TOKEN or CONDUCTOR_APP_ID+CONDUCTOR_APP_PRIVATE_KEY. Refusing AGENT_GH_TOKEN / reviewer tokens (identity split).\n');
    process.exit(2);
  }

  if (args.implement) {
    try {
      assertProducerToken(process.env);
    } catch (err) {
      process.stderr.write(`✖ ${err.message}\n`);
      process.exit(2);
    }
  }

  if (args.openPr) {
    try {
      assertWriterKey(process.env);
    } catch (err) {
      process.stderr.write(`✖ ${err.message}\n`);
      process.exit(2);
    }
  }

  const token = issueReadToken(conductor);
  if (!token) {
    process.stderr.write('✖ Need a conductor token to read the issue (CONDUCTOR_APP_ID + CONDUCTOR_APP_PRIVATE_KEY, or CONDUCTOR_GH_TOKEN). GH_TOKEN and GITHUB_TOKEN also work for a local read.\n');
    process.exit(2);
  }

  const tenant = loadTenant(args.tenantPath);
  const payload = await gh(`/repos/${args.repo}/issues/${args.issue}`, { token });
  const issue = issueFromGitHub(args.repo, payload);
  const gateInputs = buildGateInputs(args);
  const scan = resolveScanInput(args, issue);
  const entitlement = await resolveEntitlement({ repo: args.repo, tenant, env: process.env });
  const trigger = await resolveTrigger({
    repo: args.repo, login: args.requestedBy, token, ghImpl: gh,
  });
  if (args.planIn) assertStillEntitled({ issue, tenant, entitlement, trigger });
  const { intake, plan } = args.planIn
    ? readPlanFile(args.planIn, {
      repo: args.repo, issue: args.issue, updatedAt: payload.updated_at, profile: args.profile,
    })
    : await completeThroughStageB({
      issue,
      tenant,
      entitlement,
      trigger,
      scan,
      budget: gateInputs.budget,
      routing: loadRouting(repoRoot),
      critic: args.liveCritic ? critiquePlanLive : undefined,
      revise: args.liveCritic
        ? (plan, findings, prompt) => revisePlanLive(plan, findings, { prompt })
        : undefined,
      profile: args.profile,
      repoRoot,
    });
  if (args.planOut && !args.planIn) {
    writePlanFile(args.planOut, {
      repo: args.repo,
      issue: args.issue,
      updatedAt: payload.updated_at,
      profile: args.profile,
      intake,
      plan,
    });
  }

  if (args.post && intake.tier !== 'SKIPPED') {
    const comment = plan.status === 'accepted'
      ? plan.plan
      : plan.status === 'needs-info'
        ? ['Plan red-team did not pass:', ...(plan.findings || []).map((f) => `- ${f.claim}`)].join('\n')
        : (intake.questions || []).map((q) => `- ${q}`).join('\n');
    if (comment) {
      await gh(`/repos/${args.repo}/issues/${args.issue}/comments`, {
        token: conductor,
        method: 'POST',
        body: { body: comment },
      });
    }
  }

  const implementation = args.implement
    ? await implementFromPlan({ args, issue, plan })
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
    });
  } else if (label) {
    process.stderr.write('✖ conductor token missing; left the issue label unchanged.\n');
  }

  process.stderr.write(`${JSON.stringify({
    task: 'Issue-loop Stage A through Stage C',
    inputs: [
      `issue=${args.repo}#${args.issue}`,
      `post=${args.post}`,
      `implement=${args.implement}`,
      `openPr=${args.openPr}`,
      `liveCritic=${args.liveCritic}`,
      `modelRoute=${loadModelConfig(process.env).mode}`,
      `scan=${args.scanStatus || (args.scan ? 'local' : 'UNSCANNED')}`,
      `profile=${args.profile || 'code'}`,
      `budget=${args.budgetState || 'unverified'}`,
      `requestedBy=${args.requestedBy || 'none'}`,
    ],
    actions: [intake.tier, plan.status, implementation && implementation.status, ...(intake.reasons || [])].filter(Boolean),
    risks: [
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
  process.stdout.write(`${JSON.stringify({ intake, plan, implementation, review }, null, 2)}\n`);
}

function activeLoopLabel({ post, intake, plan, implementation, review } = {}) {
  if (implementation && implementation.opened) {
    if (review && review.status === 'delegated' && review.label) return review.label;
    return implementation.label || '';
  }
  if (!post || !intake || intake.tier === 'SKIPPED') return '';
  if (plan && (plan.status === 'accepted' || plan.status === 'needs-info')) return plan.label || '';
  return intake.label || '';
}

async function syncNoemiLabel({ repo, number, label, current, token, ghImpl } = {}) {
  const call = ghImpl || gh;
  const names = labelsOf({ labels: current });
  for (const name of names) {
    if (!name.startsWith('noemi:') || name === label) continue;
    const encoded = encodeURIComponent(name);
    try {
      await call(`/repos/${repo}/issues/${number}/labels/${encoded}`, { token, method: 'DELETE' });
    } catch (err) {
      if (!err || err.status !== 404) throw err;
    }
  }
  if (label && !names.includes(label)) {
    await call(`/repos/${repo}/issues/${number}/labels`, {
      token,
      method: 'POST',
      body: { labels: [label] },
    });
  }
}

function exitCodeForError(err) {
  return err && Number.isInteger(err.status) && err.status >= 500 ? 2 : 1;
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`✖ ${err.message}\n`);
    process.exit(exitCodeForError(err));
  });
}

module.exports = {
  parseArgs, buildGateInputs, resolveScanInput, loadTenant, assertRepoIssue, exitCodeForError, implementFromPlan, issueReadToken,
  activeLoopLabel, syncNoemiLabel, readPlanFile, writePlanFile, assertStillEntitled,
};
