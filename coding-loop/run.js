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
 * --post requires CONDUCTOR_GH_TOKEN.
 * --implement / --open-pr require AGENT_GH_TOKEN.
 * --open-pr also requires XAI_API_KEY and calls Grok, then opens the PR.
 * --live-critic requires ADC (GCP_ACCESS_TOKEN or gcloud) and calls Gemini.
 */

const fs = require('fs');
const path = require('path');
const { gh } = require('../scripts/github-client.js');
const { issueFromGitHub } = require('./intake.js');
const { completeThroughStageB, loadRouting } = require('./plan.js');
const { assertProducerToken, openImplementationPr, prepareImplementation } = require('./dispatch.js');
const { critiquePlanLive } = require('./critic.js');
const { assertWriterKey, draftChanges } = require('./writer.js');
const { scanIssueBody } = require('./scan.js');
const { prepareReview } = require('./stage-d.js');

const repoRoot = path.join(__dirname, '..');

function parseArgs(argv) {
  // No permissive defaults: security gates fail CLOSED. A scan status exists
  // only if a scanner produced one, and budget capacity exists only if the
  // caller checked it — the CLI asserting either by default was a critical
  // review finding (fail-open by omission).
  const args = {
    post: false,
    implement: false,
    openPr: false,
    liveCritic: false,
    scanStatus: null,
    budgetState: null,
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
      case '--scan-status': args.scanStatus = argv[++i]; break;
      case '--budget-ok': args.budgetState = 'ok'; break;
      case '--budget-exhausted': args.budgetState = 'exhausted'; break;
      case '--help':
        process.stdout.write('Usage: coding-loop/run.js --repo owner/name --issue N [--post] [--implement] [--open-pr] [--live-critic] [--tenant path] --scan-status APPROVED|BLOCKED|REDACTED (--budget-ok | --budget-exhausted)\n'
          + 'Omitting --scan-status or the budget assertion classifies the issue as REFUSED (fail closed).\n'
          + '--implement prepares a noemi-agent PR envelope.\n'
          + '--open-pr (with --implement) drafts files via Grok and opens the PR as noemi-agent.\n'
          + '--live-critic runs Gemini Pro for Stage B′; without it B′ is structural only.\n');
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

function loadTenant(relPath) {
  const file = path.resolve(repoRoot, relPath || 'tenants/internal.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function conductorToken() {
  const token = process.env.CONDUCTOR_GH_TOKEN;
  if (token) return token;
  return '';
}

function readToken() {
  return conductorToken()
    || process.env.GH_TOKEN
    || process.env.GITHUB_TOKEN
    || '';
}

async function implementFromPlan({ args, issue, plan }) {
  const branches = ['develop', 'dev', 'main'];
  const prepared = prepareImplementation({ issue, plan, branches });
  if (!args.openPr || prepared.status !== 'ready') return prepared;

  const drafted = await draftChanges({ issue, plan, env: process.env });
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
    token: process.env.AGENT_GH_TOKEN,
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
  } catch (err) {
    process.stderr.write(`✖ ${err.message}\n`);
    process.exit(2);
  }

  if (args.openPr && !args.implement) {
    process.stderr.write('✖ --open-pr requires --implement.\n');
    process.exit(2);
  }

  if (args.post && !conductorToken()) {
    process.stderr.write('✖ --post requires CONDUCTOR_GH_TOKEN. Refusing AGENT_GH_TOKEN / reviewer tokens (identity split).\n');
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

  const token = args.post ? conductorToken() : readToken();
  if (!token) {
    process.stderr.write('✖ Need a GitHub token to read the issue (CONDUCTOR_GH_TOKEN, GH_TOKEN, or GITHUB_TOKEN).\n');
    process.exit(2);
  }

  const tenant = loadTenant(args.tenantPath);
  const payload = await gh(`/repos/${args.repo}/issues/${args.issue}`, { token });
  const issue = issueFromGitHub(args.repo, payload);
  const gateInputs = buildGateInputs(args);
  if (!gateInputs.scan) {
    gateInputs.scan = scanIssueBody(`${issue.title || ''}\n${issue.body || ''}`);
  }
  const { intake, plan } = await completeThroughStageB({
    issue,
    tenant,
    scan: gateInputs.scan,
    budget: gateInputs.budget,
    routing: loadRouting(repoRoot),
    critic: args.liveCritic ? critiquePlanLive : undefined,
  });

  if (args.post && intake.tier !== 'SKIPPED') {
    const label = (plan.status === 'accepted' || plan.status === 'needs-info')
      ? plan.label
      : intake.label;
    await gh(`/repos/${args.repo}/issues/${args.issue}/labels`, {
      token: conductorToken(),
      method: 'POST',
      body: { labels: [label] },
    });
    const comment = plan.status === 'accepted'
      ? plan.plan
      : plan.status === 'needs-info'
        ? ['Plan red-team did not pass:', ...(plan.findings || []).map((f) => `- ${f.claim}`)].join('\n')
        : (intake.questions || []).map((q) => `- ${q}`).join('\n');
    if (comment) {
      await gh(`/repos/${args.repo}/issues/${args.issue}/comments`, {
        token: conductorToken(),
        method: 'POST',
        body: { body: comment },
      });
    }
  }

  const implementation = args.implement
    ? await implementFromPlan({ args, issue, plan })
    : null;
  const review = prepareReview({ implementation });

  process.stderr.write(`${JSON.stringify({
    task: 'Issue-loop Stage A through Stage C',
    inputs: [
      `issue=${args.repo}#${args.issue}`,
      `post=${args.post}`,
      `implement=${args.implement}`,
      `openPr=${args.openPr}`,
      `liveCritic=${args.liveCritic}`,
      `scan=${args.scanStatus || 'UNSCANNED'}`,
      `budget=${args.budgetState || 'unverified'}`,
    ],
    actions: [intake.tier, plan.status, implementation && implementation.status, ...(intake.reasons || [])].filter(Boolean),
    risks: [
      intake.mode === 'heuristic' ? 'sufficiency is heuristic until the Stage A model is wired' : null,
      plan.mode === 'heuristic' && plan.status === 'accepted' ? 'Stage B′ used the structural critic; pass --live-critic for Gemini' : null,
      plan.status === 'needs-info' ? 'Stage B′ hit the cycle limit' : null,
      implementation && implementation.status === 'ready' && implementation.opened !== true
        ? 'Stage C envelope ready; pass --open-pr to draft with Grok and open as noemi-agent'
        : null,
    ].filter(Boolean),
    result: (implementation && implementation.label) || plan.label || intake.label,
  })}\n`);
  process.stdout.write(`${JSON.stringify({ intake, plan, implementation, review }, null, 2)}\n`);
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
  parseArgs, buildGateInputs, loadTenant, assertRepoIssue, exitCodeForError, implementFromPlan,
};
