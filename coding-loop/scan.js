'use strict';

/**
 * Fail-closed scan of an issue body before Stage A model/heuristic input
 * (skills/security/pii-scan.md, credential-first), and of model output
 * before it is posted to the forge (scanOutboundText).
 *
 * Blocks private keys (PEM and PGP), cloud and SaaS tokens (AWS incl. STS,
 * GitHub classic and fine-grained, Anthropic, OpenAI project keys, Google,
 * xAI, Stripe, GitLab, npm, Slack tokens and webhooks, Azure DevOps PATs,
 * Azure storage keys and SAS signatures), JWTs, connection strings with
 * credentials, SSNs, and Luhn-valid card numbers (PAN).
 * Does not block email/phone: those are already on the GitHub issue.
 */

// Card numbers. A bare 13-19 digit Luhn-valid run is common in logs (about
// one long numeric id in ten passes Luhn: trace ids, snowflakes, epoch
// nanoseconds), so two shapes count:
//   (a) grouped like a card, 4-4-4-(1..7) with one consistent space or dash
//       separator, Luhn-valid;
//   (b) an ungrouped 13-19 digit run, Luhn-valid, only within ~30 characters
//       of a card keyword.
// Issuer prefixes 2-6 only (Mastercard 2/5, Amex 3, Visa 4, Discover 6), so a
// 13-digit millisecond timestamp (1…) is never a candidate.
const PAN_GROUPED_RE = /(?<![\d-])[2-6]\d{3}([ -])\d{4}\1\d{4}\1\d{1,7}(?![\d-])/g;
const PAN_UNGROUPED_RE = /(?<![\d-])[2-6]\d{12,18}(?![\d-])/g;
const CARD_KEYWORD_RE = /\b(?:cards?|credit|debit|pan|visa|mastercard|amex|cvv|cvc|expiry|cc[\s_-]?(?:number|num|no))(?![a-z])/i;
const CARD_KEYWORD_WINDOW = 30;

function luhnValid(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

function cardCandidate(digits) {
  if (digits.length < 13 || digits.length > 19) return false;
  // A run of one repeated digit (0000 0000 0000 0) is filler, not a card.
  if (/^(\d)\1+$/.test(digits)) return false;
  return luhnValid(digits);
}

function hasCardNumber(text) {
  const payload = String(text);
  for (const match of payload.matchAll(PAN_GROUPED_RE)) {
    if (cardCandidate(match[0].replace(/[ -]/g, ''))) return true;
  }
  for (const match of payload.matchAll(PAN_UNGROUPED_RE)) {
    if (!cardCandidate(match[0])) continue;
    const start = Math.max(0, match.index - CARD_KEYWORD_WINDOW);
    const end = match.index + match[0].length + CARD_KEYWORD_WINDOW;
    if (CARD_KEYWORD_RE.test(payload.slice(start, end))) return true;
  }
  return false;
}

/**
 * Azure DevOps PATs. The current format is 84 characters with the fixed
 * `AZDO` signature at offsets 76-79. The legacy format is 52 lowercase
 * base32 characters, which also matches ordinary hashes, so it only counts
 * next to a keyword that names it as a token.
 */
const ADO_PAT_RE = /(?<![A-Za-z0-9])[A-Za-z0-9]{76}AZDO[A-Za-z0-9]{4}(?![A-Za-z0-9])/;
const ADO_LEGACY_PAT_RE = /\b(?:pat|token|azure|ado|devops|personal[\s_-]?access)\b[^\n]{0,40}?(?<![a-z2-7])[a-z2-7]{52}(?![a-z2-7])/i;

// A SAS URL carries both a service version and a signature.
function hasSasToken(text) {
  return /[?&]sig=[A-Za-z0-9%+/=]{10,}/i.test(text) && /[?&]sv=\d{4}-\d{2}-\d{2}/i.test(text);
}

// Any URL for these services. Exported for writer.js, which matches URLs
// with it; the scan itself only blocks a credentialed one (below).
const CONNECTION_STRING_RE = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|amqps?):\/\/\S+/i;
const CONNECTION_STRING_GLOBAL_RE = new RegExp(CONNECTION_STRING_RE.source, 'gi');
const SECRET_QUERY_RE = /[?&](?:password|pwd|pass|token|secret)=[^&\s]/i;

/**
 * A service URL is a finding only when it carries a credential: userinfo
 * with a password (`user:pass@`, `:pass@`) or a secret query parameter.
 * Host-only URLs (`redis://localhost:6379`, `postgres://db:5432/app`) are
 * ordinary config in issues and code and must not block a run, and a bare
 * username (`reader@db`) is not a secret.
 */
function hasCredentialedConnectionString(text) {
  for (const [url] of String(text).matchAll(CONNECTION_STRING_GLOBAL_RE)) {
    const authority = url.slice(url.indexOf('://') + 3).split(/[/?#]/)[0];
    const at = authority.lastIndexOf('@');
    if (at >= 0) {
      const userinfo = authority.slice(0, at);
      const colon = userinfo.indexOf(':');
      if (colon >= 0 && colon < userinfo.length - 1) return true;
    }
    if (SECRET_QUERY_RE.test(url)) return true;
  }
  return false;
}

const PATTERNS = [
  { type: 'private_key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { type: 'pgp_private_key', re: /-----BEGIN PGP PRIVATE KEY BLOCK-----/ },
  { type: 'aws_key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { type: 'github_token', re: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { type: 'github_pat', re: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { type: 'slack_token', re: /\bxox[baprs]-/ },
  { type: 'slack_webhook', re: /hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9_/-]{8,}/i },
  { type: 'anthropic_key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  // sk-proj-…, sk-svcacct-…, and classic sk-…: the body may contain dashes.
  // One dash-free run of 20+ is required, so `sk-learn-compatible-wrapper` passes.
  { type: 'openai_key', re: /\bsk-(?:[A-Za-z0-9_]+-)*[A-Za-z0-9_]{20,}/ },
  { type: 'google_api_key', re: /\bAIza[0-9A-Za-z_-]{35}/ },
  { type: 'xai_key', re: /\bxai-[A-Za-z0-9_-]{20,}/ },
  { type: 'stripe_key', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/ },
  { type: 'gitlab_token', re: /\bglpat-[A-Za-z0-9_-]{20,}/ },
  { type: 'npm_token', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { type: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { type: 'azure_devops_pat', re: ADO_PAT_RE },
  { type: 'azure_devops_pat', re: ADO_LEGACY_PAT_RE },
  { type: 'azure_storage_key', re: /\bAccountKey=[A-Za-z0-9+/]{20,}={0,2}/i },
  { type: 'azure_sas', test: hasSasToken },
  { type: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { type: 'card_number', test: hasCardNumber },
  { type: 'connection_string', test: hasCredentialedConnectionString },
];

function matches(pattern, text) {
  return typeof pattern.test === 'function' ? pattern.test(text) : pattern.re.test(text);
}

function findingsFor(text) {
  const payload = String(text == null ? '' : text);
  const findings = [];
  const seen = new Set();
  for (const pattern of PATTERNS) {
    if (seen.has(pattern.type)) continue;
    if (matches(pattern, payload)) {
      seen.add(pattern.type);
      findings.push({ type: pattern.type, redacted: false });
    }
  }
  return findings;
}

function scanIssueBody(text) {
  const payload = String(text == null ? '' : text);
  const findings = findingsFor(payload);
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

/**
 * Model output bound for the forge (plan comment, PR body). Same patterns
 * as the inbound scan: a model can echo or invent a credential, and a
 * posted comment cannot be unposted.
 */
function scanOutboundText(text) {
  const findings = findingsFor(text);
  return {
    status: findings.length > 0 ? 'BLOCKED' : 'APPROVED',
    findings,
  };
}

module.exports = {
  CONNECTION_STRING_RE,
  PATTERNS,
  hasCardNumber,
  hasCredentialedConnectionString,
  luhnValid,
  scanIssueBody,
  scanOutboundText,
};
