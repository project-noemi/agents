#!/usr/bin/env node
'use strict';

/**
 * Stage A entry for the issue-coding loop.
 *
 * Runs Stage A (intake + sufficiency) then a Stage B plan *draft*.
 * The draft is never `accepted` — Stage B′ is not wired yet.
 *
 * USAGE
 *   node coding-loop/run.js --repo org/name --issue 12
 *   node coding-loop/run.js --repo org/name --issue 12 --post
 *
 * --post applies the conductor label. It requires CONDUCTOR_GH_TOKEN and
 * refuses AGENT_GH_TOKEN / REVIEWER_* so identities stay split.
 * Without --post the classification is printed and nothing is written.
 */

const fs = require('fs');
const path = require('path');
const { gh } = require('../scripts/github-client.js');
const { issueFromGitHub } = require('./intake.js');
const { completeThroughStageB, loadRouting } = require('./plan.js');

const repoRoot = path.join(__dirname, '..');

function parseArgs(argv) {
  // No permissive defaults: security gates fail CLOSED. A scan status exists
  // only if a scanner produced one, and budget capacity exists only if the
  // caller checked it — the CLI asserting either by default was a critical
  // review finding (fail-open by omission).
  const args = { post: false, scanStatus: null, budgetState: null };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--repo': args.repo = argv[++i]; break;
      case '--issue': args.issue = argv[++i]; break;
      case '--post': args.post = true; break;
      case '--tenant': args.tenantPath = argv[++i]; break;
      case '--scan-status': args.scanStatus = argv[++i]; break;
      case '--budget-ok': args.budgetState = 'ok'; break;
      case '--budget-exhausted': args.budgetState = 'exhausted'; break;
      case '--help':
        process.stdout.write('Usage: coding-loop/run.js --repo owner/name --issue N [--post] [--tenant path] --scan-status APPROVED|BLOCKED|REDACTED (--budget-ok | --budget-exhausted)\n'
          + 'Omitting --scan-status or the budget assertion classifies the issue as REFUSED (fail closed).\n');
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

  if (args.post && !conductorToken()) {
    process.stderr.write('✖ --post requires CONDUCTOR_GH_TOKEN. Refusing AGENT_GH_TOKEN / reviewer tokens (identity split).\n');
    process.exit(2);
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
  const { intake, plan } = completeThroughStageB({
    issue,
    tenant,
    scan: gateInputs.scan,
    budget: gateInputs.budget,
    routing: loadRouting(repoRoot),
  });

  if (args.post && intake.tier !== 'SKIPPED') {
    const label = plan.status === 'draft' ? plan.label : intake.label;
    await gh(`/repos/${args.repo}/issues/${args.issue}/labels`, {
      token: conductorToken(),
      method: 'POST',
      body: { labels: [label] },
    });
    const comment = plan.status === 'draft'
      ? plan.plan
      : (intake.questions || []).map((q) => `- ${q}`).join('\n');
    if (comment) {
      await gh(`/repos/${args.repo}/issues/${args.issue}/comments`, {
        token: conductorToken(),
        method: 'POST',
        body: { body: comment },
      });
    }
  }

  process.stderr.write(`${JSON.stringify({
    task: 'Issue-loop Stage A then Stage B draft',
    inputs: [`issue=${args.repo}#${args.issue}`, `post=${args.post}`, `scan=${args.scanStatus || 'UNSCANNED'}`, `budget=${args.budgetState || 'unverified'}`],
    actions: [intake.tier, plan.status, ...(intake.reasons || [])],
    risks: [
      intake.mode === 'heuristic' ? 'sufficiency is heuristic until the Stage A model is wired' : null,
      plan.status === 'draft' ? 'plan is a draft; Stage B′ has not accepted it' : null,
    ].filter(Boolean),
    result: plan.status === 'draft' ? plan.label : intake.label,
  })}\n`);
  process.stdout.write(`${JSON.stringify({ intake, plan }, null, 2)}\n`);
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

module.exports = { parseArgs, buildGateInputs, loadTenant, assertRepoIssue, exitCodeForError };
