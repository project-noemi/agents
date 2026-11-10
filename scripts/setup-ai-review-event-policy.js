#!/usr/bin/env node
'use strict';

// Create (or confirm) a repository Actions event policy that allowlists
// pull_request_target for .github/workflows/ai-review.yml only.
//
// GitHub's default public-repo policy blocks pull_request_target (evaluate
// mode until 2026-12-02; brownouts already fail those runs with
// startup_failure and no jobs). This workflow still needs that event because
// fork pull_request withholds secrets. The workflow never checks out, builds,
// or runs pull-request head code.
//
// Requires a repository administrator. The noemi-agent PAT cannot apply this
// (Actions policies API returns 403/404 without admin).
//
// Usage:
//   node scripts/setup-ai-review-event-policy.js
//   node scripts/setup-ai-review-event-policy.js --dry-run
//   REPO=owner/repo node scripts/setup-ai-review-event-policy.js
//
// Decision [2026-11-09-0001]. Docs: docs/AI_REVIEW_GOVERNANCE.md
// § GitHub default block of pull_request_target.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PAYLOAD_PATH = path.join(__dirname, 'ai-review-event-policy.json');
const WORKFLOW_PATH = '.github/workflows/ai-review.yml';

function loadPayload() {
    return JSON.parse(fs.readFileSync(PAYLOAD_PATH, 'utf8'));
}

function allowedEvents(payload) {
    const rule = (payload.rules || []).find((r) => r.type === 'restrict_action_events');
    return rule && Array.isArray(rule.parameters && rule.parameters.allowed_events)
        ? rule.parameters.allowed_events.slice()
        : [];
}

function matchingPolicy(policies, payload) {
    const wantPath = payload.conditions.workflow_path.include[0];
    const wantEvents = allowedEvents(payload);
    return (policies || []).find((p) => {
        const include = (p.conditions && p.conditions.workflow_path && p.conditions.workflow_path.include) || [];
        if (!include.includes(wantPath)) return false;
        return (p.rules || []).some((r) => {
            if (r.type !== 'restrict_action_events') return false;
            const have = (r.parameters && r.parameters.allowed_events) || [];
            return wantEvents.every((event) => have.includes(event));
        });
    }) || null;
}

function parseArgs(argv) {
    const out = { dryRun: false, repo: process.env.REPO || '' };
    for (const arg of argv) {
        if (arg === '--dry-run' || arg === '--print') out.dryRun = true;
        else if (arg.startsWith('--repo=')) out.repo = arg.slice('--repo='.length);
        else if (arg === '--help' || arg === '-h') out.help = true;
        else {
            const err = new Error(`Unknown argument: ${arg}`);
            err.code = 'USAGE';
            throw err;
        }
    }
    return out;
}

function ghJson(args, input) {
    const res = spawnSync('gh', ['api', ...args], {
        encoding: 'utf8',
        input: input || undefined,
        env: process.env,
    });
    return res;
}

function resolveRepo(explicit) {
    if (explicit) return explicit;
    const res = spawnSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], {
        encoding: 'utf8',
        env: process.env,
    });
    if (res.status !== 0) {
        const err = new Error(
            (res.stderr || res.stdout || 'gh repo view failed').trim()
            || 'Could not determine the target repository. Set REPO=owner/repo.',
        );
        err.code = 'REPO';
        throw err;
    }
    return String(res.stdout || '').trim();
}

function uiHelp(payload) {
    const events = allowedEvents(payload).join(', ');
    return [
        'Apply as a repository administrator:',
        '',
        '  UI:  Settings → Actions → Policies → New policy',
        `       Name: ${payload.name}`,
        '       Enforcement: Active',
        `       Workflows: ${WORKFLOW_PATH}`,
        `       Allowed events: ${events}`,
        '',
        '  API: node scripts/setup-ai-review-event-policy.js',
        '       (this script; needs admin on the repository)',
        '',
        '  Docs: https://docs.github.com/en/actions/how-tos/administer/control-workflow-execution',
        '        https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target',
        '',
        'After a brownout startup_failure, remove and re-add the ai-review label',
        '(or close/reopen, or workflow_dispatch). Existing failed runs do not retry.',
    ].join('\n');
}

function main(argv, io) {
    const log = io.log;
    const payload = loadPayload();
    let opts;
    try {
        opts = parseArgs(argv);
    } catch (err) {
        log(err.message);
        log('Usage: node scripts/setup-ai-review-event-policy.js [--dry-run] [--repo=owner/repo]');
        return 2;
    }
    if (opts.help) {
        log('Usage: node scripts/setup-ai-review-event-policy.js [--dry-run] [--repo=owner/repo]');
        log('');
        log(uiHelp(payload));
        return 0;
    }

    if (opts.dryRun) {
        log(JSON.stringify(payload, null, 2));
        return 0;
    }

    let repo;
    try {
        repo = resolveRepo(opts.repo);
    } catch (err) {
        log(`✖ ${err.message}`);
        log('');
        log(uiHelp(payload));
        return 2;
    }

    log(`→ Listing Actions policies on ${repo}`);
    const listed = ghJson([
        `repos/${repo}/actions/policies`,
        '--paginate',
        '-H', 'Accept: application/vnd.github+json',
        '-H', 'X-GitHub-Api-Version: 2026-03-10',
    ]);
    if (listed.status !== 0) {
        const body = `${listed.stderr || ''}\n${listed.stdout || ''}`.trim();
        log('✖ Cannot list Actions policies (repository admin is required).');
        if (body) log(body);
        log('');
        log(uiHelp(payload));
        return 2;
    }

    let parsed;
    try {
        parsed = JSON.parse(listed.stdout);
    } catch (err) {
        log('✖ Actions policies response was not JSON.');
        log(String(err && err.message ? err.message : err));
        return 1;
    }
    const policies = Array.isArray(parsed) ? parsed : (parsed.policies || []);
    const existing = matchingPolicy(policies, payload);
    if (existing) {
        log(`✔ Policy already present: ${existing.name} (id ${existing.id}, enforcement ${existing.enforcement})`);
        log(`  source: ${existing.source_type || '?'} ${existing.source || ''}`);
        return 0;
    }

    log(`→ Creating policy "${payload.name}" targeting ${WORKFLOW_PATH}`);
    const created = ghJson([
        '--method', 'POST',
        `repos/${repo}/actions/policies`,
        '-H', 'Accept: application/vnd.github+json',
        '-H', 'X-GitHub-Api-Version: 2026-03-10',
        '--input', '-',
    ], JSON.stringify(payload));
    if (created.status !== 0) {
        const body = `${created.stderr || ''}\n${created.stdout || ''}`.trim();
        log('✖ Failed to create the Actions event policy.');
        if (body) log(body);
        log('');
        log(uiHelp(payload));
        return 2;
    }
    let createdBody;
    try {
        createdBody = JSON.parse(created.stdout);
    } catch {
        createdBody = null;
    }
    const id = createdBody && createdBody.id ? createdBody.id : '?';
    log(`✔ Created policy id ${id} on ${repo}`);
    log('  Relabel any fork PR whose privileged AI Review run concluded startup_failure.');
    return 0;
}

module.exports = {
    PAYLOAD_PATH,
    WORKFLOW_PATH,
    loadPayload,
    allowedEvents,
    matchingPolicy,
    parseArgs,
    uiHelp,
    main,
};

if (require.main === module) {
    process.exit(main(process.argv.slice(2), { log: (line) => console.error(line) }));
}
