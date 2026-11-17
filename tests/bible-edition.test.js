const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  extractEditionLine,
  checkBibleEdition,
  MAX_LAG_DAYS,
} = require('../scripts/bible-edition.js');

const TAGS = ['2026.07.01', '2026.08.21', '2026.09.15', '2026.09.23'];
const NOW = Date.UTC(2026, 8, 24);

function bible(editionLine) {
  return `# Project NoéMI — Public Reference Guide\n\n${editionLine}\n\n> quote\n`;
}

test('extractEditionLine skips the title and blank lines', () => {
  assert.equal(extractEditionLine(bible('**Edition 2026.09.23**')), '**Edition 2026.09.23**');
});

test('current Bible stamp is a published CalVer edition', () => {
  const markdown = fs.readFileSync(
    path.join(__dirname, '..', 'docs/PROJECT_REFERENCE.md'),
    'utf8',
  );
  assert.match(extractEditionLine(markdown), /^\*\*Edition \d{4}\.\d{2}\.\d{2}/);
  assert.doesNotMatch(markdown.slice(0, 200), /Version 2\.0|April 2026/);
});

test('SemVer and month-name stamps fail', () => {
  const semver = checkBibleEdition({
    markdown: bible('**Version 2.0 | April 2026**'),
    tags: TAGS,
    nowUtc: NOW,
  });
  assert.ok(semver.some((e) => /Edition YYYY\.MM\.DD/.test(e)));
});

test('a published tag within the lag window passes', () => {
  const errors = checkBibleEdition({
    markdown: bible('**Edition 2026.09.23**'),
    tags: TAGS,
    nowUtc: NOW,
  });
  assert.deepEqual(errors, []);
});

test('an unpublished or future stamp fails', () => {
  const unknown = checkBibleEdition({
    markdown: bible('**Edition 2026.09.24**'),
    tags: TAGS,
    nowUtc: NOW,
  });
  assert.ok(unknown.some((e) => /not a published CalVer tag/.test(e)));
});

test('a stamp older than MAX_LAG_DAYS behind the latest tag fails', () => {
  const errors = checkBibleEdition({
    markdown: bible('**Edition 2026.07.01**'),
    tags: TAGS,
    nowUtc: NOW,
  });
  const lag = Math.floor((Date.UTC(2026, 8, 23) - Date.UTC(2026, 6, 1)) / 86400000);
  assert.ok(lag > MAX_LAG_DAYS, 'fixture lag must exceed the cap');
  assert.ok(errors.some((e) => /lags latest CalVer/.test(e)));
});

test('no tags is a hard fail, not a skip', () => {
  const errors = checkBibleEdition({
    markdown: bible('**Edition 2026.09.23**'),
    tags: [],
    nowUtc: NOW,
  });
  assert.ok(errors.some((e) => /No CalVer tags/.test(e)));
});
