const test = require('node:test');
const assert = require('node:assert/strict');
const {
  wantsClassic,
  describeProducerTokenShape,
  resolveProducerToken,
} = require('../scripts/agent-token.js');

test('wantsClassic is opt-in: 1/true/yes only', () => {
  assert.equal(wantsClassic({}), false);
  assert.equal(wantsClassic({ AGENT_GH_USE_CLASSIC: '' }), false);
  assert.equal(wantsClassic({ AGENT_GH_USE_CLASSIC: '0' }), false);
  assert.equal(wantsClassic({ AGENT_GH_USE_CLASSIC: 'maybe' }), false);
  assert.equal(wantsClassic({ AGENT_GH_USE_CLASSIC: '1' }), true);
  assert.equal(wantsClassic({ AGENT_GH_USE_CLASSIC: 'true' }), true);
  assert.equal(wantsClassic({ AGENT_GH_USE_CLASSIC: 'YES' }), true);
});

test('default path uses AGENT_GH_TOKEN and ignores classic even if present', () => {
  const out = resolveProducerToken({
    AGENT_GH_TOKEN: 'fine',
    AGENT_GH_TOKEN_CLASSIC: 'classic',
  });
  assert.equal(out.source, 'AGENT_GH_TOKEN');
  assert.equal(out.token, 'fine');
});

test('classic path uses AGENT_GH_TOKEN_CLASSIC even when AGENT_GH_TOKEN is set', () => {
  const out = resolveProducerToken({
    AGENT_GH_USE_CLASSIC: '1',
    AGENT_GH_TOKEN: 'fine',
    AGENT_GH_TOKEN_CLASSIC: 'classic',
  });
  assert.equal(out.source, 'AGENT_GH_TOKEN_CLASSIC');
  assert.equal(out.token, 'classic');
});

test('classic path refuses to fall back to AGENT_GH_TOKEN', () => {
  assert.throws(
    () => resolveProducerToken({
      AGENT_GH_USE_CLASSIC: '1',
      AGENT_GH_TOKEN: 'fine',
    }),
    /Refusing to fall back to AGENT_GH_TOKEN/,
  );
});

test('default path still requires AGENT_GH_TOKEN', () => {
  assert.throws(
    () => resolveProducerToken({ AGENT_GH_TOKEN_CLASSIC: 'classic' }),
    /AGENT_GH_TOKEN/,
  );
});

test('agent-gh.sh classic path refuses AGENT_GH_TOKEN fallback', () => {
  const fs = require('fs');
  const path = require('path');
  const { spawnSync } = require('child_process');
  const sh = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'agent-gh.sh'), 'utf8');
  assert.match(sh, /AGENT_GH_USE_CLASSIC/);
  assert.match(sh, /AGENT_GH_TOKEN_CLASSIC/);
  assert.match(sh, /Refusing to fall back to AGENT_GH_TOKEN/);
  assert.match(sh, /resolve_classic_token/);
  const script = path.join(__dirname, '..', 'scripts', 'agent-gh.sh');
  const result = spawnSync('bash', [script, 'whoami'], {
    env: {
      PATH: '/usr/bin:/bin',
      AGENT_GH_USE_CLASSIC: '1',
      AGENT_GH_TOKEN: 'fine-should-not-be-used',
    },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to fall back to AGENT_GH_TOKEN/);
});

test('shape helper classifies prefixes without exposing the rest of the token', () => {
  assert.equal(describeProducerTokenShape('github_pat_abc'), 'fine-grained');
  assert.equal(describeProducerTokenShape('ghp_abc'), 'classic');
  assert.equal(describeProducerTokenShape('ghs_abc'), 'unknown');
  assert.equal(describeProducerTokenShape(''), 'empty');
});
