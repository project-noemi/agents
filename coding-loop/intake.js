'use strict';

/**
 * Deterministic Stage A gates for the issue-coding loop
 * (skills/classification/issue-intake.md).
 *
 * Sufficiency (whether a competent implementer can start) is a model call
 * and is NOT performed here. After every hard gate passes this module
 * returns PENDING_SUFFICIENCY — never ACTIONABLE. Defaulting to actionable
 * is forbidden by the skill.
 */

const BOT_LOGINS = new Set(['dependabot', 'renovate', 'github-actions']);
const WRITE_PERMISSIONS = new Set(['admin', 'maintain', 'write']);

const EMPTY_SECTION_MARKERS = [
  /^_no response_$/i,
  /^n\/a$/i,
  /^tbd$/i,
  /^todo$/i,
  /^\.+$/,
];

function labelsOf(issue) {
  const raw = issue && issue.labels;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item.name === 'string') return item.name;
    return '';
  }).filter(Boolean);
}

function isBotAuthor(issue) {
  const login = String((issue && issue.author) || '').replace(/^@/, '').toLowerCase();
  const type = String((issue && issue.author_type) || '').toLowerCase();
  if (type === 'bot') return true;
  if (login.endsWith('[bot]')) return true;
  return BOT_LOGINS.has(login);
}

function isEmptyOrTemplate(issue) {
  const title = String((issue && issue.title) || '').trim();
  const body = String((issue && issue.body) || '').trim();
  if (!title && !body) return true;
  if (!body) return true;

  const withoutHeadings = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^#{1,6}\s/.test(line) && !/^[-*]\s*$/.test(line));

  if (withoutHeadings.length === 0) return true;
  return withoutHeadings.every((line) => EMPTY_SECTION_MARKERS.some((re) => re.test(line)));
}

function repoAllowed(org, repo, repos) {
  // Missing or [] means every repo in orgs (documented internal default).
  // A present non-array is a broken allowlist — fail closed, do not treat
  // it as "allow all" (review finding on #423, merged over that fail).
  if (repos !== undefined && repos !== null && !Array.isArray(repos)) {
    return { ok: false, reason: 'tenant-misconfigured' };
  }
  const allow = Array.isArray(repos) ? repos : [];
  if (allow.length > 0 && !allow.includes(`${org}/${repo}`)) {
    return { ok: false, reason: 'outside-tenant' };
  }
  return { ok: true };
}

function withVia(result, via) {
  return result.ok ? { ok: true, via } : result;
}

/**
 * Orgs on the tenant's static list pass on the list alone. Any other org is
 * a client and needs `entitlement` from coding-loop/entitlement.js: the
 * conductor App installed and not suspended, AND an active registry row for
 * the installation's account ID (Decision [2026-10-22-0005]).
 */
function tenantAllows(issue, tenant, entitlement) {
  const org = issue && issue.org;
  const repo = issue && issue.repo;
  const orgs = (tenant && Array.isArray(tenant.orgs)) ? tenant.orgs : [];
  if (org && orgs.includes(org)) {
    return withVia(repoAllowed(org, repo, tenant && tenant.limits ? tenant.limits.repos : undefined), 'tenant');
  }
  if (!org || !entitlement) {
    return { ok: false, reason: 'outside-tenant' };
  }
  if (entitlement.error) return { ok: false, reason: 'entitlement-unverified' };
  if (!entitlement.installation) return { ok: false, reason: 'app-not-installed' };
  if (entitlement.installation.suspended) return { ok: false, reason: 'installation-suspended' };
  if (!entitlement.client) return { ok: false, reason: 'unregistered-client' };
  if (entitlement.client.status !== 'active') return { ok: false, reason: 'client-suspended' };
  return withVia(repoAllowed(org, repo, entitlement.client.repos), 'client');
}

/**
 * Tenant or client entitlement, plus the requester check for client runs:
 * a client run needs a named requester with write access to the repo, so an
 * outsider on a public client repo cannot spend the shared pool.
 */
function entitlementGate({ issue, tenant, entitlement, trigger } = {}) {
  const allowed = tenantAllows(issue, tenant, entitlement);
  if (!allowed.ok || allowed.via !== 'client') return allowed;
  if (!trigger || !trigger.login || trigger.error) return { ok: false, reason: 'trigger-unverified' };
  if (!WRITE_PERMISSIONS.has(trigger.permission)) return { ok: false, reason: 'trigger-not-writer' };
  return allowed;
}

function classifyIssue({ issue, tenant, entitlement, trigger, scan, budget } = {}) {
  if (!issue || typeof issue !== 'object') {
    return {
      tier: 'REFUSED',
      reasons: ['invalid-issue'],
      questions: [],
      label: 'noemi:wont-act',
      confidence: 'high',
    };
  }

  const labels = labelsOf(issue);
  if (labels.includes('noemi:skip')) {
    return {
      tier: 'SKIPPED',
      reasons: ['escape-hatch'],
      questions: [],
      label: 'noemi:skip',
      confidence: 'high',
    };
  }

  if (isBotAuthor(issue)) {
    return {
      tier: 'SKIPPED',
      reasons: ['bot-author'],
      questions: [],
      label: 'noemi:skip',
      confidence: 'high',
    };
  }

  if (isEmptyOrTemplate(issue)) {
    return {
      tier: 'NEEDS_INFO',
      reasons: ['empty-or-template-body'],
      questions: ['What repository path should change, and how will we know it worked?'],
      label: 'noemi:needs-info',
      confidence: 'high',
    };
  }

  const allowed = entitlementGate({ issue, tenant, entitlement, trigger });
  if (!allowed.ok) {
    return {
      tier: 'REFUSED',
      reasons: [allowed.reason],
      questions: [],
      label: 'noemi:wont-act',
      confidence: 'high',
    };
  }

  // Symmetric with the unscanned-body gate below: an UNKNOWN budget state is
  // refused, not waved through. Only an explicit exhausted:boolean asserts
  // that someone actually checked capacity.
  if (!budget || typeof budget !== 'object' || typeof budget.exhausted !== 'boolean') {
    return {
      tier: 'REFUSED',
      reasons: ['budget-unverified'],
      questions: [],
      label: 'noemi:wont-act',
      confidence: 'high',
    };
  }

  if (budget.exhausted) {
    return {
      tier: 'REFUSED',
      reasons: ['budget'],
      questions: [],
      label: 'noemi:wont-act',
      confidence: 'high',
    };
  }

  if (!scan || typeof scan !== 'object' || !scan.status) {
    return {
      tier: 'REFUSED',
      reasons: ['unscanned-body'],
      questions: [],
      label: 'noemi:wont-act',
      confidence: 'high',
    };
  }

  if (scan.status === 'BLOCKED') {
    return {
      tier: 'REFUSED',
      reasons: ['scan-blocked'],
      questions: [],
      label: 'noemi:wont-act',
      confidence: 'high',
    };
  }

  return {
    tier: 'PENDING_SUFFICIENCY',
    reasons: ['deterministic-gates-passed'],
    questions: [],
    label: 'noemi:queued',
    confidence: 'high',
  };
}

function issueFromGitHub(repoFullName, payload) {
  const [org, repo] = String(repoFullName || '').split('/');
  const user = payload && payload.user ? payload.user : {};
  return {
    org,
    repo,
    number: payload && payload.number,
    author: user.login,
    author_type: user.type === 'Bot' ? 'bot' : 'user',
    title: payload && payload.title,
    body: payload && payload.body,
    labels: payload && payload.labels,
  };
}

module.exports = {
  BOT_LOGINS,
  classifyIssue,
  entitlementGate,
  issueFromGitHub,
  isBotAuthor,
  isEmptyOrTemplate,
  labelsOf,
  tenantAllows,
};
