'use strict';

/**
 * Issue #630: a documented query must rank the page that answers it.
 * Headings, use_when, and keywords outweigh body text. A page's own
 * `queries` list is not scored: that list records what the author expects
 * people to ask, and scoring it would make the check pass by copying the
 * question onto the page. The check reads the repository files NoéMi Code
 * reads. It does not call the Knowledge MCP.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const queries = require('./knowledge-queries.json');
const ROOTS = ['docs', 'agents', 'skills'];
const SKIP = new Set(['skills-dist', 'node_modules']);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.name.endsWith('.md')) out.push(abs);
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { fields: {}, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { fields: {}, body: text };
  const raw = text.slice(4, end);
  const body = text.slice(end + 5);
  const fields = {};
  let listKey = null;
  for (const line of raw.split('\n')) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && listKey) {
      fields[listKey].push(item[1].trim());
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!pair) continue;
    listKey = null;
    const value = pair[2].trim();
    if (value === '') {
      fields[pair[1]] = [];
      listKey = pair[1];
    } else if (value.startsWith('[') && value.endsWith(']')) {
      fields[pair[1]] = value.slice(1, -1).split(',').map((part) => part.trim()).filter(Boolean);
    } else {
      fields[pair[1]] = value;
    }
  }
  return { fields, body };
}

function tokens(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length > 2);
}

function scoreFile(text, queryTokens) {
  const { fields, body } = parseFrontmatter(text);
  const weighted = [
    [fields.use_when || '', 3],
    [Array.isArray(fields.keywords) ? fields.keywords.join(' ') : '', 3],
  ];
  const headings = body.split('\n').filter((line) => /^#{1,3}\s/.test(line)).join(' ');
  weighted.push([headings, 3]);
  weighted.push([body, 1]);
  let score = 0;
  for (const [chunk, weight] of weighted) {
    const have = new Set(tokens(chunk));
    for (const word of queryTokens) {
      if (have.has(word)) score += weight;
    }
  }
  return score;
}

function rank(query) {
  const queryTokens = tokens(query);
  const files = [];
  for (const root of ROOTS) walk(path.join(repoRoot, root), files);
  const scored = files.map((abs) => {
    const rel = path.relative(repoRoot, abs);
    return { rel, score: scoreFile(fs.readFileSync(abs, 'utf8'), queryTokens) };
  });
  scored.sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel));
  return scored;
}

test('issue 630 queries rank the page that answers them', () => {
  for (const item of queries) {
    const ranked = rank(item.query);
    const top = ranked[0];
    assert.ok(top.score > 0, `${item.query} matched nothing`);
    assert.equal(top.rel, item.path, `${item.query} ranked ${top.rel} (score ${top.score}) above ${item.path}`);
  }
});

test('principle pages declare use_when and tier', () => {
  // Issue #630 names this set as NoéMi Code's governing list. `tier: principle`
  // is that list. pii-scan is a skill and pii-guard is a guardian; they are
  // on the list because an agent must find them when a task touches personal
  // data, not because the files are essays.
  const required = [
    'docs/PROJECT_REFERENCE.md',
    'docs/PHASE_ZERO_SECURITY_BASELINE.md',
    'docs/SOVEREIGN_LLM_GUIDELINES.md',
    'docs/GOVERNANCE.md',
    'docs/frameworks/gartner-trism.md',
    'docs/TRANSPARENT_SOURCE.md',
    'docs/tool-usages/secure-secret-management.md',
    'skills/security/pii-scan.md',
    'agents/guardian/pii-guard.md',
  ];
  for (const rel of required) {
    const { fields } = parseFrontmatter(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
    assert.equal(typeof fields.use_when, 'string', rel);
    assert.ok(fields.use_when.length > 20, rel);
    assert.equal(fields.tier, 'principle', rel);
  }
});

test('the phase 0 heading describes scope, not employee replacement', () => {
  const text = fs.readFileSync(path.join(repoRoot, 'docs/PHASE_ZERO_SECURITY_BASELINE.md'), 'utf8');
  assert.match(text, /### Scope and limits of this assessment/);
  assert.doesNotMatch(text, /What This Assessment Does Not Replace/);
});
