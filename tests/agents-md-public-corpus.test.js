'use strict';

// AGENTS.md is served by the public NoéMI Knowledge MCP, whose strict corpus build
// (project-noemi/code packages/knowledge-core) refuses internal identity content. Keep the
// machine account's numeric GitHub id and noreply address in docs/MACHINE_IDENTITY.md
// (not part of the public corpus) instead of AGENTS.md.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('AGENTS.md carries no machine-account id or noreply address', () => {
  const text = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  const idRow = fs
    .readFileSync(path.join(root, 'docs/MACHINE_IDENTITY.md'), 'utf8')
    .match(/\*\*GitHub user ID\*\*\s*\|\s*`(\d+)`/);
  assert.ok(idRow, 'docs/MACHINE_IDENTITY.md lists the GitHub user ID');
  assert.ok(!new RegExp(`\\b${idRow[1]}\\b`).test(text), 'AGENTS.md contains the numeric GitHub user ID');
  assert.ok(!/users\.noreply\.github\.com/.test(text), 'AGENTS.md contains a GitHub noreply address');
});

test('AGENTS.md still points commits at the machine identity', () => {
  const text = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(text, /Commit as `noemi-agent`.*docs\/MACHINE_IDENTITY\.md/);
});
