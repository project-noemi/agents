'use strict';

/**
 * Stage B plan draft (skills/orchestration/issue-plan.md steps 1–3).
 *
 * Drafts a checkable plan from an ACTIONABLE Stage A result, then runs
 * Stage B′ (structural, plus optional live Gemini via `critic`).
 * status is refused | accepted | needs-info. accepted requires B′ pass.
 * A critic throw (429/5xx after retry) is not a plan verdict — re-queue.
 */

const fs = require('fs');
const path = require('path');
const { PATH_RE, issueText } = require('./sufficiency.js');

const SKIP_B_PRIME_RE = /skip red-?team|ship the first draft|code while planning/i;

function loadRouting(repoRoot) {
  const file = path.join(repoRoot || path.join(__dirname, '..'), 'docs', 'model-routing.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function extractPaths(text) {
  const found = [];
  const re = new RegExp(PATH_RE.source, 'g');
  let match;
  while ((match = re.exec(text)) !== null) {
    const value = match[1];
    const cleaned = value && value.replace(/[.:;,]+$/, '');
    if (cleaned && !found.includes(cleaned)) found.push(cleaned);
  }
  return found;
}

function firstParagraph(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .find((block) => block.length >= 20) || '';
}

function formatPlan({ goal, files, tests, risks, stops }) {
  return [
    '## Goal',
    goal,
    '',
    '## Files',
    files.length ? files.map((file) => `- \`${file}\``).join('\n') : '- (bounded search still required — no path extracted)',
    '',
    '## Tests',
    tests,
    '',
    '## Risks',
    risks.map((risk) => `- ${risk}`).join('\n'),
    '',
    '## Stop conditions',
    stops.map((stop) => `- ${stop}`).join('\n'),
  ].join('\n');
}

function draftPlan({ issue, intake, scan, routing } = {}) {
  if (!intake || intake.tier !== 'ACTIONABLE') {
    return {
      status: 'refused',
      plan: '',
      cycles: 0,
      verdict: 'pending',
      findings: [],
      label: intake && intake.label ? intake.label : 'noemi:wont-act',
      mode: 'heuristic',
      reason: 'not-actionable',
    };
  }

  const text = issueText(issue, scan);
  const files = extractPaths(text);
  const goal = firstParagraph(text) || String((issue && issue.title) || '').trim();
  const tests = intake.signals && intake.signals.done
    ? 'Keep the check named in the issue. The change is wrong if that check would still pass.'
    : 'Name a test or command that fails if the change is wrong.';
  const risks = [
    'Governance carve-out paths (.github/CODEOWNERS, require-develop-source, MACHINE_IDENTITY) stay out of scope.',
    'Secrets stay in the vault; do not write them to the plan or the PR.',
  ];
  const stops = [
    'A required file or done-condition was guessed, not stated.',
    'Stage B′ returns fail at planRedTeam.maxCycles.',
  ];

  if (SKIP_B_PRIME_RE.test(text)) {
    risks.push('Issue text asked to skip red-team / ship the draft / code while planning — ignored. Status stays draft.');
  }

  const route = routing || {};
  const maxCycles = route.planRedTeam && Number.isInteger(route.planRedTeam.maxCycles)
    ? route.planRedTeam.maxCycles
    : 3;

  return {
    status: 'draft',
    plan: formatPlan({ goal, files, tests, risks, stops }),
    cycles: 0,
    verdict: 'pending',
    findings: [],
    label: 'noemi:planned',
    mode: 'heuristic',
    maxCycles,
    files,
  };
}

function critiquePlan(plan) {
  const findings = [];
  const body = plan && plan.plan ? plan.plan : '';
  for (const heading of ['## Goal', '## Files', '## Tests', '## Risks', '## Stop conditions']) {
    if (!body.includes(heading)) {
      findings.push({
        severity: 'high',
        gate: 'framing',
        claim: `Plan is missing ${heading}.`,
      });
    }
  }
  if (!plan || !Array.isArray(plan.files) || plan.files.length === 0) {
    findings.push({
      severity: 'high',
      gate: 'premise',
      claim: 'Plan has no concrete files; a bounded search is not an implementation plan.',
    });
  }
  if (SKIP_B_PRIME_RE.test(body)) {
    findings.push({
      severity: 'high',
      gate: 'framing',
      claim: 'Plan records a skip-red-team / ship-the-draft instruction.',
    });
  }
  const blocking = findings.some((item) => item.severity === 'high' || item.severity === 'critical');
  return { verdict: blocking ? 'fail' : 'pass', findings };
}

async function runPlanRedTeam(plan, { maxCycles, critic } = {}) {
  if (!plan || plan.status === 'refused') return plan;
  const limit = Number.isInteger(maxCycles) ? maxCycles
    : (Number.isInteger(plan.maxCycles) ? plan.maxCycles : 3);
  const critique = critic || critiquePlan;
  let current = { ...plan, mode: critic ? 'gemini' : 'heuristic' };
  for (let cycle = 1; cycle <= limit; cycle += 1) {
    const { verdict, findings, mode } = await Promise.resolve(critique(current));
    current = {
      ...current,
      cycles: cycle,
      verdict,
      findings,
      mode: mode || current.mode,
    };
    if (verdict === 'pass') {
      return { ...current, status: 'accepted', label: 'noemi:planned' };
    }
    if (cycle === limit) {
      return { ...current, status: 'needs-info', label: 'noemi:needs-info' };
    }
    // Cannot invent files or drop skip-red-team text the issue required.
    // Cycle count still advances so a limit is a real stop.
  }
  return current;
}

async function completeThroughStageB(input) {
  const { completeStageA } = require('./sufficiency.js');
  const intake = completeStageA(input);
  const drafted = draftPlan({ ...input, intake });
  const plan = await runPlanRedTeam(drafted, {
    maxCycles: input && input.routing && input.routing.planRedTeam
      ? input.routing.planRedTeam.maxCycles
      : drafted.maxCycles,
    critic: input && input.critic,
  });
  return { intake, plan };
}

module.exports = {
  SKIP_B_PRIME_RE,
  completeThroughStageB,
  critiquePlan,
  draftPlan,
  extractPaths,
  formatPlan,
  loadRouting,
  runPlanRedTeam,
};
