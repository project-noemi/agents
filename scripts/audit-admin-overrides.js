#!/usr/bin/env node
/**
 * Admin-override watch (Decision [2026-08-17-0001]).
 *
 * WHY MONITORING INSTEAD OF PREVENTION
 *   `enforce_admins` is not a real boundary against admins: an admin can drop
 *   the rules, push, and restore the rules. Owner decision 2026-08-17 keeps the
 *   admin override available on `develop` as the escape hatch against a
 *   fully-stuck system, and makes DETECTION the control instead. Every use of
 *   admin capability on a protected branch must surface within a day and be
 *   attested by a human — silent override is the only prohibited state.
 *
 * WHAT IT DETECTS (per repo, on the protected branches)
 *   direct-push        commit on a protected branch with no associated PR
 *                      (the ff66bdc class: pushed straight to develop)
 *   unreviewed-merge   PR merged into develop without an approving review
 *                      (requires an admin bypass while 1 review is required)
 *   self-merge         PR merged by its own author (humans; the release App's
 *                      scoped promotion exception per Decision [2026-08-14-0002]
 *                      is allowlisted)
 *   manual-promotion   PR into main not authored AND merged by the release App
 *                      (the #397 class: off-cycle human promotion)
 *   protection-drift   live branch protection differs from the payloads in
 *                      scripts/setup-branch-protection.sh — catches
 *                      dropped-and-not-restored rules. Requires admin read;
 *                      degrades to a notice when the token cannot see it.
 *
 * WHAT IT CANNOT DETECT (stated so nobody trusts it beyond its reach)
 *   A drop-override-restore executed between two daily runs leaves protection
 *   looking intact; only its EFFECTS (the classes above) are visible. The org
 *   audit log (`protected_branch.*` events) would close that gap but needs an
 *   audit-log-capable credential; see the ORG AUDIT LOG note in main().
 *
 * USAGE
 *   node scripts/audit-admin-overrides.js                # report, window=2 days
 *   WINDOW_DAYS=7 node scripts/audit-admin-overrides.js
 *   REPOS="project-noemi/agents,newpush/platform" node scripts/audit-admin-overrides.js
 *
 * OUTPUT
 *   stdout: findings as markdown (empty on a clean window) — the issue body
 *   stderr: structured JSON audit log per CLAUDE.md
 *   exit 0: clean window   exit 4: findings present (never 1: `infisical run`
 *   collapses child codes, and 4 is unambiguous for the workflow to key on)
 */

'use strict';

const { execFileSync } = require('node:child_process');

const REPOS = (process.env.REPOS || 'project-noemi/agents')
  .split(',').map((s) => s.trim()).filter(Boolean);
const WINDOW_DAYS = Number(process.env.WINDOW_DAYS || 2);
const PROTECTED_BRANCHES = ['develop', 'main'];

/** The release App's scoped exception: it may author and merge ONLY
 *  develop→main promotion PRs (Decision [2026-08-14-0002]). */
const RELEASE_BOT = 'noemi-release-bot';

// ---------------------------------------------------------------------------
// Pure classifiers (unit-tested; all GitHub data arrives as arguments)
// ---------------------------------------------------------------------------

/**
 * A commit is legitimately on a protected branch only if a MERGED pull request
 * based on that branch delivered it (for main, a develop-based PR also counts:
 * promotion sweeps develop history into main).
 *
 * Association alone is NOT legitimacy: the real ff66bdc incident was pushed
 * straight to develop and later swept into promotion PR #397 (base main) —
 * an "any associated PR" test launders every direct push to develop the moment
 * the next daily promotion runs. Branch-aware association does not.
 */
function classifyCommit(commit, branch) {
  const merged = (commit.associatedPRs || []).filter((pr) => pr.state === 'MERGED');
  const legit = merged.some((pr) => pr.baseRefName === branch
    || (branch === 'main' && pr.baseRefName === 'develop'));
  if (legit) return null;
  return {
    kind: 'direct-push',
    severity: 'high',
    branch,
    detail: `commit ${commit.oid.slice(0, 7)} ("${commit.headline}") by ${commit.actor} `
      + `committed ${commit.committedDate} reached protected '${branch}' with no merged pull request `
      + `based on it${merged.length ? ` (only swept later into: ${merged.map((p) => `#${p.number}→${p.baseRefName}`).join(', ')})` : ''}`,
  };
}

/** Classify a merged PR against the review and promotion rules. */
function classifyMergedPR(pr) {
  const findings = [];
  const author = pr.author || '(unknown)';
  const merger = pr.mergedBy || '(unknown)';
  const isReleaseBot = (login) => login === RELEASE_BOT || login === `${RELEASE_BOT}[bot]` || login === `app/${RELEASE_BOT}`;

  if (pr.baseRefName === 'main') {
    // Promotions are the release App's job, end to end.
    if (!(isReleaseBot(author) && isReleaseBot(merger))) {
      findings.push({
        kind: 'manual-promotion',
        severity: 'high',
        branch: 'main',
        detail: `PR #${pr.number} ("${pr.title}") into main authored by ${author}, merged by ${merger} `
          + `at ${pr.mergedAt} — outside the release App's scoped promotion exception`,
      });
    }
    return findings;
  }

  if (pr.baseRefName === 'develop') {
    if (pr.approvedReviewCount === 0) {
      findings.push({
        kind: 'unreviewed-merge',
        severity: 'high',
        branch: 'develop',
        detail: `PR #${pr.number} ("${pr.title}") merged into develop by ${merger} at ${pr.mergedAt} `
          + 'with zero approving reviews — develop requires one, so this took an admin bypass '
          + '(or the rule was off at the time)',
      });
    }
    if (author === merger && !isReleaseBot(author)) {
      findings.push({
        kind: 'self-merge',
        severity: 'medium',
        branch: 'develop',
        detail: `PR #${pr.number} ("${pr.title}") was merged by its own author (${author}) at ${pr.mergedAt}`,
      });
    }
  }

  return findings;
}

/**
 * Compare live protection against the expected policy. `expected` mirrors the
 * payloads in scripts/setup-branch-protection.sh — keep the two in sync.
 */
const EXPECTED_PROTECTION = {
  main: {
    enforce_admins: true,
    required_approving_review_count: 0,
    contexts: ['check-source-branch', 'Audit, Generate, and Fast Tests'],
  },
  develop: {
    // Deliberately FALSE (owner decision 2026-08-17): the admin override is the
    // escape hatch, and THIS monitor is the compensating control.
    enforce_admins: false,
    required_approving_review_count: 1,
    require_code_owner_reviews: true,
    contexts: ['Audit, Generate, and Fast Tests', 'Cross-Model PR Review'],
  },
};

function diffProtection(branch, live) {
  const expected = EXPECTED_PROTECTION[branch];
  if (!expected || !live) return [];
  const drift = [];

  if (live.enforce_admins !== undefined && live.enforce_admins !== expected.enforce_admins) {
    drift.push(`enforce_admins is ${live.enforce_admins}, expected ${expected.enforce_admins}`);
  }
  if (live.required_approving_review_count !== undefined
      && live.required_approving_review_count !== expected.required_approving_review_count) {
    drift.push(`required approvals is ${live.required_approving_review_count}, expected ${expected.required_approving_review_count}`);
  }
  if (expected.require_code_owner_reviews !== undefined
      && live.require_code_owner_reviews !== undefined
      && live.require_code_owner_reviews !== expected.require_code_owner_reviews) {
    drift.push(`require_code_owner_reviews is ${live.require_code_owner_reviews}, expected ${expected.require_code_owner_reviews}`);
  }
  if (Array.isArray(live.contexts)) {
    const missing = expected.contexts.filter((c) => !live.contexts.includes(c));
    if (missing.length) drift.push(`required checks missing: ${missing.join(', ')}`);
  }

  return drift.map((d) => ({
    kind: 'protection-drift',
    severity: 'high',
    branch,
    detail: `${branch}: ${d}`,
  }));
}

function renderFindings(repo, findings, windowDays) {
  if (findings.length === 0) return '';
  const lines = [
    `### ${repo} — ${findings.length} admin-capability event(s) in the last ${windowDays} day(s)`,
    '',
    '| Kind | Severity | Branch | Detail |',
    '|---|---|---|---|',
  ];
  for (const f of findings) {
    lines.push(`| ${f.kind} | ${f.severity} | ${f.branch} | ${f.detail.replace(/\|/g, '\\|')} |`);
  }
  lines.push('', '**Attestation required.** For each event, a human (not the actor) confirms it was'
    + ' legitimate and states why — or opens remediation. Silent override is the one prohibited state'
    + ' (Decision [2026-08-17-0001]).');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// GitHub I/O
// ---------------------------------------------------------------------------

function gh(args, input) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
}

function fetchBranchCommits(owner, name, branch, sinceIso) {
  const query = `query($owner:String!,$name:String!,$ref:String!,$since:GitTimestamp!){
    repository(owner:$owner,name:$name){ ref(qualifiedName:$ref){ target{ ... on Commit {
      history(since:$since, first: 100){ nodes{
        oid messageHeadline committedDate
        author{ user{ login } name }
        associatedPullRequests(first:10){ nodes{ number baseRefName state } }
      } } } } } } }`;
  const out = JSON.parse(gh(['api', 'graphql',
    '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`,
    '-f', `ref=refs/heads/${branch}`, '-f', `since=${sinceIso}`]));
  const nodes = out?.data?.repository?.ref?.target?.history?.nodes || [];
  return nodes.map((n) => ({
    oid: n.oid,
    headline: (n.messageHeadline || '').slice(0, 80),
    committedDate: n.committedDate,
    actor: n.author?.user?.login || n.author?.name || '(unknown)',
    associatedPRs: (n.associatedPullRequests?.nodes || []).map((p) => ({
      number: p.number, baseRefName: p.baseRefName, state: p.state,
    })),
  }));
}

function fetchMergedPRs(owner, name, sinceIso) {
  const query = `query($owner:String!,$name:String!){
    repository(owner:$owner,name:$name){ pullRequests(states:MERGED, first: 60,
      orderBy:{field:UPDATED_AT, direction:DESC}){ nodes{
        number title baseRefName mergedAt
        author{ login } mergedBy{ login }
        reviews(states:APPROVED, first:1){ totalCount }
      } } } }`;
  const out = JSON.parse(gh(['api', 'graphql',
    '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`]));
  const nodes = out?.data?.repository?.pullRequests?.nodes || [];
  return nodes
    .filter((n) => n.mergedAt >= sinceIso)
    .map((n) => ({
      number: n.number,
      title: (n.title || '').slice(0, 80),
      baseRefName: n.baseRefName,
      mergedAt: n.mergedAt,
      author: n.author?.login || '(unknown)',
      mergedBy: n.mergedBy?.login || '(unknown)',
      approvedReviewCount: n.reviews?.totalCount ?? 0,
    }));
}

function fetchProtection(owner, name, branch) {
  try {
    const raw = JSON.parse(gh(['api', `repos/${owner}/${name}/branches/${branch}/protection`]));
    return {
      enforce_admins: raw?.enforce_admins?.enabled,
      required_approving_review_count: raw?.required_pull_request_reviews?.required_approving_review_count,
      require_code_owner_reviews: raw?.required_pull_request_reviews?.require_code_owner_reviews,
      contexts: raw?.required_status_checks?.contexts,
    };
  } catch {
    // Reading protection needs repo-admin; the workflow's GITHUB_TOKEN cannot
    // hold that. Degrade to a notice — the effect-level checks above still run.
    return null;
  }
}

async function main() {
  const sinceIso = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const all = [];
  const notices = [];

  for (const repo of REPOS) {
    const [owner, name] = repo.split('/');
    const findings = [];

    for (const branch of PROTECTED_BRANCHES) {
      let commits = [];
      try {
        commits = fetchBranchCommits(owner, name, branch, sinceIso);
      } catch (err) {
        notices.push(`${repo}@${branch}: commit scan failed (${String(err.message).slice(0, 80)})`);
        continue;
      }
      for (const commit of commits) {
        // A branch's history includes PR merge commits; those have an
        // associated PR and classify clean. Only orphan commits surface.
        const f = classifyCommit(commit, branch);
        if (f) findings.push(f);
      }

      const live = fetchProtection(owner, name, branch);
      if (live === null) {
        notices.push(`${repo}@${branch}: protection unreadable with this credential — drift layer skipped `
          + '(grant the watch credential repo Administration:read to enable it)');
      } else {
        findings.push(...diffProtection(branch, live));
      }
    }

    try {
      for (const pr of fetchMergedPRs(owner, name, sinceIso)) {
        findings.push(...classifyMergedPR(pr));
      }
    } catch (err) {
      notices.push(`${repo}: merged-PR scan failed (${String(err.message).slice(0, 80)})`);
    }

    const rendered = renderFindings(repo, findings, WINDOW_DAYS);
    if (rendered) all.push(rendered);
  }

  // ORG AUDIT LOG (not implemented): `gh api /orgs/<org>/audit-log` with a
  // read:audit_log credential would expose protected_branch.* events and close
  // the drop-override-restore blind spot between daily runs. Wire it here when
  // such a credential exists; until then the limitation is documented above.

  if (notices.length) {
    all.push(['### Coverage notices', '', ...notices.map((n) => `- ${n}`)].join('\n'));
  }

  const hasFindings = all.some((block) => !block.startsWith('### Coverage notices'));
  process.stderr.write(`${JSON.stringify({
    task: 'Admin-override watch',
    inputs: [`repos=${REPOS.join(',')}`, `window_days=${WINDOW_DAYS}`],
    actions: ['scanned protected-branch commits', 'scanned merged PRs', 'compared protection where readable'],
    risks: hasFindings ? ['admin-capability use detected — attestation required'] : [],
    result: hasFindings ? 'findings' : 'clean',
  })}\n`);

  process.stdout.write(all.join('\n\n') + (all.length ? '\n' : ''));
  process.exit(hasFindings ? 4 : 0);
}

module.exports = {
  classifyCommit, classifyMergedPR, diffProtection, renderFindings, EXPECTED_PROTECTION,
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`✖ ${err.stack || err.message}\n`);
    process.exit(2);
  });
}
