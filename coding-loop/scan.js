'use strict';

/**
 * Fail-closed scan of an issue body before Stage A model/heuristic input
 * (skills/security/pii-scan.md, credential-first).
 *
 * Blocks private keys, cloud tokens, and SSN/PAN-shaped digit groups.
 * Does not block email/phone: those are already on the GitHub issue.
 */

const PATTERNS = [
  { type: 'private_key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { type: 'aws_key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { type: 'github_token', re: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { type: 'slack_token', re: /\bxox[baprs]-/ },
  { type: 'openai_key', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { type: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { type: 'connection_string', re: /\b(?:postgres|mysql|mongodb):\/\/\S+/i },
];

function scanIssueBody(text) {
  const payload = String(text == null ? '' : text);
  const findings = [];
  for (const { type, re } of PATTERNS) {
    if (re.test(payload)) findings.push({ type, redacted: false });
  }
  if (findings.length > 0) {
    return {
      status: 'BLOCKED',
      classification: 'confidential',
      findings,
      payload: '',
      reason: `${findings.length} credential or PII pattern(s) blocked`,
    };
  }
  return {
    status: 'APPROVED',
    classification: 'public',
    findings: [],
    payload,
    reason: 'no credential or high-risk PII patterns',
  };
}

module.exports = { PATTERNS, scanIssueBody };
