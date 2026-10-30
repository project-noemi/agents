'use strict';

/**
 * Repository path rules shared by every stage that accepts a path from an
 * issue, a model reply, or a plan file.
 *
 * isSafeRepoPath is an allow-list, not a decoder. A path that only becomes
 * dangerous after a percent-decode, a backslash fold, or a Unicode
 * normalisation is refused as written, so no later layer (GitHub contents
 * API, an Azure DevOps checkout, a Windows runner) can turn it into a
 * traversal or a carve-out bypass.
 *
 * The carve-out list is the UNION for every forge the loop may drive
 * (GitHub, Azure DevOps, GitLab) and compares case-insensitively: ADO and
 * Windows checkouts are case-insensitive, so `codeowners` must not slip past
 * a list that says `CODEOWNERS`.
 */

const path = require('path');

const MAX_PATH_CHARS = 1024;
// Printable ASCII that real source trees use. No `%` (encoded traversal),
// no `\` (Windows separator), no `:` (drive letters, NTFS streams), no `~`
// (8.3 short names), no spaces, no shell or URL metacharacters.
const SAFE_PATH_RE = /^[A-Za-z0-9._\-/+@,=[\]()]+$/;

// Exact governance files (compared lowercase).
const CARVE_OUT = [
  '.github/CODEOWNERS',
  'CODEOWNERS',
  'docs/CODEOWNERS',
  '.gitlab/CODEOWNERS',
  'docs/MACHINE_IDENTITY.md',
  'docs/AI_REVIEW_GOVERNANCE.md',
  'scripts/audit-repo.js',
  'azure-pipelines.yml',
  'azure-pipelines.yaml',
  '.gitlab-ci.yml',
];

// CI definitions and composite actions run with repository credentials.
// Listing individual YAML files is not enough: any file under these is a
// CI remote-code-execution surface.
const CARVE_OUT_PREFIXES = [
  '.github/workflows/',
  '.github/actions/',
  '.azure-pipelines/',
  '.azuredevops/',
  '.pipelines/',
];

// Pipeline definitions at any depth. Azure Pipelines runs a YAML file from
// any path the build definition names (`ci/azure-pipelines.yml`,
// `sub/azure-pipelines.yaml`), and `.vsts-ci.yml` is the legacy default name.
// Matched on the folded path, so case and Windows folding cannot dodge them:
//   **/*azure-pipelines*.y?ml, .vsts-ci.yml, **/.vsts-ci.yml
// A definition at an arbitrary name (`build/pipeline.yml`) is looked up per
// repository by the provider (Azure DevOps commitFiles), not listed here.
const CARVE_OUT_PATTERNS = [
  /(?:^|\/)[^/]*azure-pipelines[^/]*\.ya?ml$/,
  /(?:^|\/)\.vsts-ci\.ya?ml$/,
];

const CARVE_OUT_LOWER = new Set(CARVE_OUT.map((item) => item.toLowerCase()));

function normalizeRepoPath(filePath) {
  return path.posix.normalize(String(filePath || '').replace(/\\/g, '/')).replace(/^\.\/+/, '');
}

/**
 * True only for a plain relative repository path: ASCII allow-list, no
 * leading `/`, no empty, `.`, or `..` segment, no `.git` segment, and no
 * segment ending in `.` (Windows strips a trailing dot, so `CODEOWNERS.`
 * would land on the carve-out).
 */
function isSafeRepoPath(filePath) {
  if (typeof filePath !== 'string') return false;
  if (!filePath || filePath.length > MAX_PATH_CHARS) return false;
  if (!SAFE_PATH_RE.test(filePath)) return false;
  if (filePath.startsWith('/')) return false;
  const segments = filePath.split('/');
  return segments.every((segment) => (
    segment.length > 0
    && segment !== '.'
    && segment !== '..'
    && !segment.endsWith('.')
    && segment.toLowerCase() !== '.git'
  ));
}

/**
 * Case-folded comparison form: backslashes folded, `.` / `..` resolved,
 * leading `./` and `/` dropped, trailing dots and spaces per segment dropped.
 */
function foldForCarveOut(filePath) {
  return normalizeRepoPath(filePath)
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => segment.replace(/[. ]+$/, ''))
    .join('/')
    .toLowerCase();
}

function isCarvedOut(filePath) {
  const folded = foldForCarveOut(filePath);
  if (CARVE_OUT_LOWER.has(folded)) return true;
  if (CARVE_OUT_PATTERNS.some((re) => re.test(folded))) return true;
  return CARVE_OUT_PREFIXES.some((prefix) => (
    folded === prefix.replace(/\/$/, '') || folded.startsWith(prefix)
  ));
}

/**
 * Per-segment URL encoding for a forge contents/items API. Refuses an unsafe
 * path instead of encoding it: `%2e%2e` must never reach the URL builder.
 */
function encodeRepoPath(filePath) {
  if (!isSafeRepoPath(filePath)) {
    const err = new Error(`Refusing unsafe repository path: ${JSON.stringify(String(filePath).slice(0, 120))}`);
    err.status = 400;
    err.code = 'unsafe-repo-path';
    throw err;
  }
  return filePath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

module.exports = {
  CARVE_OUT,
  CARVE_OUT_PATTERNS,
  CARVE_OUT_PREFIXES,
  MAX_PATH_CHARS,
  encodeRepoPath,
  foldForCarveOut,
  isCarvedOut,
  isSafeRepoPath,
  normalizeRepoPath,
};
