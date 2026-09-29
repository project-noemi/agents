'use strict';

/**
 * Public Bible (docs/PROJECT_REFERENCE.md) edition stamp.
 *
 * The stamp is a published CalVer tag, not SemVer and not a month name.
 * The release job cannot rewrite main (no branch write), so the stamp may lag
 * the latest tag until the next narrative pass. A five-month "Version 2.0 |
 * April 2026" line is the failure this check exists to catch.
 *
 * Decision [2026-09-24-0003].
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDITION_RE = /^\*\*Edition (\d{4}\.\d{2}\.\d{2}(?:\.\d+)?)\*\*\s*$/;
const CALVER_RE = /^(\d{4})\.(\d{2})\.(\d{2})(?:\.(\d+))?$/;
const MAX_LAG_DAYS = 45;

function parseCalVer(tag) {
  const m = String(tag).trim().match(CALVER_RE);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = Date.UTC(year, month - 1, day);
  return { tag: String(tag).trim(), utc, year, month, day };
}

function extractEditionLine(markdown) {
  const lines = String(markdown).split(/\n/);
  for (const line of lines) {
    if (line.startsWith('# ')) continue;
    if (line.trim() === '') continue;
    return line;
  }
  return '';
}

function listCalVerTags(repoRoot) {
  const out = execFileSync('git', ['tag', '-l'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => CALVER_RE.test(t));
}

function checkBibleEdition({ markdown, tags, nowUtc = Date.now() } = {}) {
  const errors = [];
  const line = extractEditionLine(markdown);
  const match = line.match(EDITION_RE);
  if (!match) {
    errors.push(
      `docs/PROJECT_REFERENCE.md edition line must be **Edition YYYY.MM.DD** (optional .N). Found: ${JSON.stringify(line)}`,
    );
    return errors;
  }
  const edition = parseCalVer(match[1]);
  if (!edition) {
    errors.push(`Bible edition ${match[1]} is not a valid CalVer date.`);
    return errors;
  }
  const parsedTags = (tags || []).map(parseCalVer).filter(Boolean);
  if (parsedTags.length === 0) {
    errors.push('No CalVer tags are visible; fetch tags before auditing the Bible edition.');
    return errors;
  }
  const known = new Set(parsedTags.map((t) => t.tag));
  if (!known.has(edition.tag)) {
    errors.push(
      `Bible edition ${edition.tag} is not a published CalVer tag. Stamp the last published tag, not a future or invented date.`,
    );
  }
  parsedTags.sort((a, b) => a.utc - b.utc || a.tag.localeCompare(b.tag));
  const latest = parsedTags[parsedTags.length - 1];
  const lagDays = Math.floor((latest.utc - edition.utc) / 86400000);
  if (lagDays > MAX_LAG_DAYS) {
    errors.push(
      `Bible edition ${edition.tag} lags latest CalVer ${latest.tag} by ${lagDays} days (max ${MAX_LAG_DAYS}).`,
    );
  }
  if (edition.utc > nowUtc + 86400000) {
    errors.push(`Bible edition ${edition.tag} is in the future.`);
  }
  return errors;
}

function checkBibleEditionFile(repoRoot) {
  const file = path.join(repoRoot, 'docs/PROJECT_REFERENCE.md');
  const markdown = fs.readFileSync(file, 'utf8');
  const tags = listCalVerTags(repoRoot);
  return checkBibleEdition({ markdown, tags });
}

module.exports = {
  CALVER_RE,
  EDITION_RE,
  MAX_LAG_DAYS,
  parseCalVer,
  extractEditionLine,
  listCalVerTags,
  checkBibleEdition,
  checkBibleEditionFile,
};
