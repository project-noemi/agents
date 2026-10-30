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

const { matchTarget, ownerEntryMatches, repoEntryMatches } = require('./providers/contract.js');

const BOT_LOGINS = new Set(['dependabot', 'renovate', 'github-actions']);
const WRITE_PERMISSIONS = new Set(['admin', 'maintain', 'write']);
// The only scanner verdicts that let a body through. Exact strings: a
// lower-case 'approved', 'ERROR', 'TIMEOUT' or a typo is an unknown state,
// and an unknown state is refused (fail closed), never treated as clean.
const SCAN_PROCEED_STATUSES = new Set(['APPROVED', 'REDACTED']);

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

/**
 * Accepts the intake shape (`author` login + `author_type`) and a provider
 * WorkItem (`author: { login, isBot }`, the provider's own bot verdict).
 */
function isBotAuthor(issue) {
  const author = issue && issue.author;
  if (author && typeof author === 'object' && author.isBot === true) return true;
  const rawLogin = author && typeof author === 'object' ? author.login : author;
  const login = String(rawLogin || '').replace(/^@/, '').toLowerCase();
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

/**
 * `repos` entries are a bare GitHub slug (`owner/name`, exact match as
 * always) or a full provider key (`azure-devops:org/project/repo`,
 * case-insensitive). See providers/contract.js repoEntryMatches.
 */
function repoAllowed(target, repos) {
  // Missing or [] means every repo in orgs (documented internal default).
  // A present non-array is a broken allowlist — fail closed, do not treat
  // it as "allow all" (review finding on #423, merged over that fail).
  if (repos !== undefined && repos !== null && !Array.isArray(repos)) {
    return { ok: false, reason: 'tenant-misconfigured' };
  }
  const allow = Array.isArray(repos) ? repos : [];
  if (allow.length > 0 && !allow.some((entry) => repoEntryMatches(entry, target))) {
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
  // `issue.provider` (default github) and `issue.project` place the repo on
  // its forge; `orgs` entries are a bare GitHub owner or `<provider>:<owner>`.
  const target = matchTarget(issue);
  const orgs = (tenant && Array.isArray(tenant.orgs)) ? tenant.orgs : [];
  if (org && target && orgs.some((entry) => ownerEntryMatches(entry, target))) {
    return withVia(repoAllowed(target, tenant && tenant.limits ? tenant.limits.repos : undefined), 'tenant');
  }
  if (!org || !entitlement) {
    return { ok: false, reason: 'outside-tenant' };
  }
  if (entitlement.error) return { ok: false, reason: 'entitlement-unverified' };
  // `grant` is the provider-neutral name; `installation` is the GitHub-era
  // name hosts and tests still pass.
  const grant = entitlement.grant !== undefined ? entitlement.grant : entitlement.installation;
  if (!grant) return { ok: false, reason: 'app-not-installed' };
  if (grant.suspended) return { ok: false, reason: 'installation-suspended' };
  if (!entitlement.client) return { ok: false, reason: 'unregistered-client' };
  if (entitlement.client.status !== 'active') return { ok: false, reason: 'client-suspended' };
  if (!target) return { ok: false, reason: 'outside-tenant' };
  return withVia(repoAllowed(target, entitlement.client.repos), 'client');
}

/**
 * Tenant or client entitlement, plus the requester check on EVERY run: a
 * named requester with write access to the repo. Client-only was not enough
 * — on a public tenant repo anyone who opened an issue spent the shared
 * pool and drew a conductor comment. A missing or unverifiable requester is
 * `trigger-unverified`; never default it to the token's own login (that is
 * the bot, which would always pass).
 */
function entitlementGate({ issue, tenant, entitlement, trigger } = {}) {
  const allowed = tenantAllows(issue, tenant, entitlement);
  if (!allowed.ok) return allowed;
  if (!trigger || !trigger.login || trigger.error) return { ok: false, reason: 'trigger-unverified' };
  // Set by run.js when someone below the requester bar edited the item's
  // text (--requested-by-author on a forge with provider.bodyEditors).
  if (typeof trigger.refusal === 'string' && trigger.refusal) return { ok: false, reason: trigger.refusal };
  if (!WRITE_PERMISSIONS.has(trigger.permission)) return { ok: false, reason: 'trigger-not-writer' };
  return allowed;
}

/** Refusals caused by WHO asked. The run leaves no trace on the issue for these. */
const REQUESTER_REFUSALS = new Set(['trigger-unverified', 'trigger-not-writer', 'body-edited-by-non-requester']);

/**
 * `hiddenInstructions`: run.js found instruction-like text in the item's
 * hiddenText (an HTML comment, a display:none span, white-on-white text).
 * A person reviewing the item cannot see it, so the item is REFUSED
 * (`hidden-instructions`) before any model reads it.
 */
function classifyIssue({
  issue, tenant, entitlement, trigger, scan, budget, hiddenInstructions = false,
} = {}) {
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

  // Entitlement and requester BEFORE the empty-body gate: NEEDS_INFO posts a
  // conductor question, and an outsider must not be able to draw one.
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

  if (hiddenInstructions) {
    return {
      tier: 'REFUSED',
      reasons: ['hidden-instructions'],
      questions: [],
      label: 'noemi:wont-act',
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

  if (!SCAN_PROCEED_STATUSES.has(scan.status)) {
    return {
      tier: 'REFUSED',
      reasons: ['scan-status-unknown'],
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

/**
 * REST payload → the intake shape. Kept for hosts that import it; the
 * GitHub provider owns the mapping (required lazily: the provider imports
 * BOT_LOGINS from this module).
 */
function issueFromGitHub(repoFullName, payload) {
  return require('./providers/github/index.js').issueFromPayload(repoFullName, payload);
}

module.exports = {
  BOT_LOGINS,
  REQUESTER_REFUSALS,
  SCAN_PROCEED_STATUSES,
  WRITE_PERMISSIONS,
  classifyIssue,
  entitlementGate,
  issueFromGitHub,
  isBotAuthor,
  isEmptyOrTemplate,
  labelsOf,
  tenantAllows,
};
