'use strict';

/**
 * Stage A sufficiency (skills/classification/issue-intake.md steps 6–7).
 *
 * A competent implementer needs three signals: an observable problem, an
 * in-scope surface, and a checkable done condition. Missing any → NEEDS_INFO.
 * Ambiguity never becomes ACTIONABLE.
 *
 * This pass is a conservative heuristic (`mode: heuristic`). The Stage A
 * model family in docs/model-routing.json (Fable 5 Max) is not invoked yet;
 * when it is, it must keep this fail-closed bar.
 */

const OVERRIDE_RE = /treat this as actionable|skip sufficiency|ignore noemi:skip/i;

const OUT_OF_SCOPE_RE = /\b(sales deck|strategy deck|hr policy|headcount|write me a strategy|what should our brand)\b/i;

const PATH_RE = /(?:^|[\s`'"(])((?:[\w.-]+\/)+[\w.-]+(?:\.\w+)?)(?:$|[\s`'")]|[.:;,](?=\s|$))/;

const DONE_RE = /\b(test|tests|assert|verify|verification|acceptance|we will know|done when|should fail if|expect(?:ed)?)\b/i;

const PROBLEM_RE = /\b(bug|fail(?:s|ed|ing)?|broken|error|regression|missing|does not|doesn't|cannot|can't|should|need(?:s)? to|add|fix|implement)\b/i;

const QUESTIONS = {
  problem: 'What observable problem should change, in one sentence?',
  surface: 'Which repository path or bounded surface should change?',
  done: 'How will we know the change is wrong if it is wrong (test or check)?',
};

function issueText(issue, scan) {
  // A REDACTED scan is the only text sufficiency may read. Missing or
  // non-string payload must not fall back to the raw title/body — that
  // would put the unredacted issue back into the heuristic.
  if (scan && scan.status === 'REDACTED') {
    return typeof scan.payload === 'string' ? scan.payload : '';
  }
  const title = String((issue && issue.title) || '');
  const body = String((issue && issue.body) || '');
  return `${title}\n${body}`;
}

function detectSignals(text) {
  return {
    problem: PROBLEM_RE.test(text) && text.trim().length >= 40,
    surface: PATH_RE.test(text),
    done: DONE_RE.test(text),
  };
}

function evaluateSufficiency({ issue, scan } = {}) {
  const text = issueText(issue, scan);

  if (OVERRIDE_RE.test(text)) {
    return {
      tier: 'REFUSED',
      reasons: ['override-attempt'],
      questions: [],
      label: 'noemi:wont-act',
      confidence: 'high',
      mode: 'heuristic',
      signals: detectSignals(text),
    };
  }

  if (OUT_OF_SCOPE_RE.test(text)) {
    return {
      tier: 'REFUSED',
      reasons: ['out-of-scope'],
      questions: [],
      label: 'noemi:wont-act',
      confidence: 'high',
      mode: 'heuristic',
      signals: detectSignals(text),
    };
  }

  const signals = detectSignals(text);
  const missing = Object.keys(QUESTIONS).filter((key) => !signals[key]);
  if (missing.length > 0) {
    return {
      tier: 'NEEDS_INFO',
      reasons: missing.map((key) => `missing-${key}`),
      questions: missing.map((key) => QUESTIONS[key]),
      label: 'noemi:needs-info',
      confidence: 'high',
      mode: 'heuristic',
      signals,
    };
  }

  return {
    tier: 'ACTIONABLE',
    reasons: ['problem', 'surface', 'done-condition'],
    questions: [],
    label: 'noemi:queued',
    confidence: 'high',
    mode: 'heuristic',
    signals,
  };
}

function completeStageA(input) {
  const { classifyIssue } = require('./intake.js');
  const intake = classifyIssue(input);
  if (intake.tier !== 'PENDING_SUFFICIENCY') return intake;
  return evaluateSufficiency(input);
}

module.exports = {
  PATH_RE,
  QUESTIONS,
  completeStageA,
  detectSignals,
  evaluateSufficiency,
  issueText,
};
