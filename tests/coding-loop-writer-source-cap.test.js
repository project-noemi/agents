'use strict';

// Stage C reads every plan file whole from the base branch. The per-file cap
// must admit an owning requirements document of a fleet repository (the first
// one measured was 122,491 characters) and still refuse a runaway source.
// Decision [2026-11-03-0001].

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadBaseFiles, MAX_SOURCE_CHARS } = require('../coding-loop/writer.js');

function fakeProvider(contents) {
  return {
    parseRepo: (repo) => {
      const [owner, name] = String(repo).split('/');
      return owner && name ? { owner, name } : null;
    },
    readFile: async (_target, filePath) => {
      if (!(filePath in contents)) return { missing: true };
      return { content: contents[filePath] };
    },
  };
}

test('writer source cap is 500,000 characters per file', () => {
  assert.equal(MAX_SOURCE_CHARS, 500000);
});

test('a 122k-character requirements document is loaded as a source', async () => {
  const provider = fakeProvider({ 'docs/requirements/identity-gateway.md': 'x'.repeat(122491) });
  const result = await loadBaseFiles({
    repo: 'org/repo', ref: 'develop', provider, token: 'unused',
    files: ['docs/requirements/identity-gateway.md'],
  });
  assert.equal(result.ok, true);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].content.length, 122491);
});

test('a source exactly at the cap is admitted and one character over is refused by path', async () => {
  const provider = fakeProvider({
    'docs/at-cap.md': 'y'.repeat(MAX_SOURCE_CHARS),
    'docs/over-cap.md': 'z'.repeat(MAX_SOURCE_CHARS + 1),
  });
  const atCap = await loadBaseFiles({
    repo: 'org/repo', ref: 'develop', provider, token: 'unused', files: ['docs/at-cap.md'],
  });
  assert.equal(atCap.ok, true);
  const overCap = await loadBaseFiles({
    repo: 'org/repo', ref: 'develop', provider, token: 'unused',
    files: ['docs/at-cap.md', 'docs/over-cap.md'],
  });
  assert.deepEqual(overCap, { ok: false, reason: 'writer-source-too-large', path: 'docs/over-cap.md' });
});
