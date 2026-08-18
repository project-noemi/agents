#!/usr/bin/env node
'use strict';

/**
 * Stage A entry for the issue-coding loop.
 *
 * Runs the deterministic intake gates (skip / bot / empty / tenant / scan /
 * budget). Does not call a model and does not mark ACTIONABLE.
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
const { classifyIssue, issueFromGitHub } = require('./intake.js');

const repoRoot = path.join(__dirname, '..');

function parseArgs(argv) {
  const args = { post: false, scanStatus: 'APPROVED' };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--repo': args.repo = argv[++i]; break;
      case '--issue': args.issue = argv[++i]; break;
      case '--post': args.post = true; break;
      case '--tenant': args.tenantPath = argv[++i]; break;
      case '--scan-status': args.scanStatus = argv[++i]; break;
      case '--help':
        process.stdout.write('Usage: coding-loop/run.js --repo owner/name --issue N [--post] [--tenant path] [--scan-status APPROVED|BLOCKED|REDACTED]\n');
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
  const result = classifyIssue({
    issue,
    tenant,
    scan: { status: args.scanStatus },
    budget: { exhausted: false },
  });

  if (args.post && result.tier !== 'SKIPPED') {
    await gh(`/repos/${args.repo}/issues/${args.issue}/labels`, {
      token: conductorToken(),
      method: 'POST',
      body: { labels: [result.label] },
    });
    if (result.questions.length > 0) {
      await gh(`/repos/${args.repo}/issues/${args.issue}/comments`, {
        token: conductorToken(),
        method: 'POST',
        body: { body: result.questions.map((q) => `- ${q}`).join('\n') },
      });
    }
  }

  process.stderr.write(`${JSON.stringify({
    task: 'Issue-loop Stage A deterministic intake',
    inputs: [`issue=${args.repo}#${args.issue}`, `post=${args.post}`, `scan=${args.scanStatus}`],
    actions: [result.tier, ...result.reasons],
    risks: result.tier === 'PENDING_SUFFICIENCY' ? ['sufficiency model not yet invoked'] : [],
    result: result.label,
  })}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`✖ ${err.message}\n`);
    process.exit(err.status && err.status >= 500 ? 2 : 2);
  });
}

module.exports = { parseArgs, loadTenant, assertRepoIssue };
