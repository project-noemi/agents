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

function tenantAllows(issue, tenant) {
  const org = issue && issue.org;
  const repo = issue && issue.repo;
  const orgs = (tenant && Array.isArray(tenant.orgs)) ? tenant.orgs : [];
  if (!org || !orgs.includes(org)) {
    return { ok: false, reason: 'outside-tenant' };
  }
  const allow = tenant && tenant.limits && Array.isArray(tenant.limits.repos)
    ? tenant.limits.repos
    : [];
  if (allow.length > 0 && !allow.includes(`${org}/${repo}`)) {
    return { ok: false, reason: 'outside-tenant' };
  }
  return { ok: true };
}

function classifyIssue({ issue, tenant, scan, budget } = {}) {
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

  const allowed = tenantAllows(issue, tenant);
  if (!allowed.ok) {
    return {
      tier: 'REFUSED',
      reasons: [allowed.reason],
      questions: [],
      label: 'noemi:wont-act',
      confidence: 'high',
    };
  }

  if (budget && budget.exhausted) {
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
  issueFromGitHub,
  isBotAuthor,
  isEmptyOrTemplate,
  labelsOf,
  tenantAllows,
};
