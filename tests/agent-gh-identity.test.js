// scripts/agent-gh.sh must refuse a token that resolves to the wrong account on
// every path, with no opt-in: the default and `whoami` included.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'agent-gh.sh');

// A stub `gh` that answers `gh api user` with $FAKE_GH_LOGIN and echoes any
// other call, so a test can see whether the wrapper reached `exec gh`.
function stubGhDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-gh-stub-'));
  const gh = path.join(dir, 'gh');
  fs.writeFileSync(
    gh,
    [
      '#!/usr/bin/env bash',
      'if [[ "$1" == "api" && "$2" == "user" ]]; then',
      '  if [[ "$4" == ".login" ]]; then printf "%s\\n" "$FAKE_GH_LOGIN"',
      '  else printf "%s (User)\\n" "$FAKE_GH_LOGIN"; fi',
      '  exit 0',
      'fi',
      'printf "gh called: %s\\n" "$*"',
    ].join('\n'),
  );
  fs.chmodSync(gh, 0o755);
  return dir;
}

function run(args, env) {
  const dir = stubGhDir();
  try {
    return spawnSync('bash', [SCRIPT, ...args], {
      // No vault CLIs on PATH: the token comes from AGENT_GH_TOKEN only.
      env: { PATH: `${dir}:/usr/bin:/bin`, AGENT_GH_TOKEN: 'stub-token', ...env },
      encoding: 'utf8',
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('refuses a non-agent login when AGENT_GH_EXPECTED_LOGIN is unset', () => {
  const r = run(['pr', 'list'], { FAKE_GH_LOGIN: 'some-human' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /resolves to 'some-human', expected 'noemi-agent'/);
  assert.doesNotMatch(r.stdout, /gh called/);
});

test('whoami refuses a wrong identity instead of printing it with exit 0', () => {
  const r = run(['whoami'], { FAKE_GH_LOGIN: 'some-human' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /resolves to 'some-human'/);
});

test('whoami succeeds for the default machine identity', () => {
  const r = run(['whoami'], { FAKE_GH_LOGIN: 'noemi-agent' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^noemi-agent \(User\)/);
});

test('AGENT_GH_EXPECTED_LOGIN selects another machine identity', () => {
  const ok = run(['whoami'], {
    FAKE_GH_LOGIN: 'noemi-reviewer',
    AGENT_GH_EXPECTED_LOGIN: 'noemi-reviewer',
  });
  assert.equal(ok.status, 0, ok.stderr);

  // The documented trap: a producer token already in the environment wins
  // over AGENT_GH_TOKEN_SECRET, so the override must catch it.
  const trap = run(['whoami'], {
    FAKE_GH_LOGIN: 'noemi-agent',
    AGENT_GH_EXPECTED_LOGIN: 'noemi-reviewer',
  });
  assert.notEqual(trap.status, 0);
  assert.match(trap.stderr, /expected 'noemi-reviewer'/);
});

test('passes the command through to gh for the expected identity', () => {
  const r = run(['pr', 'list', '--state', 'open'], { FAKE_GH_LOGIN: 'noemi-agent' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /gh called: pr list --state open/);
  assert.match(r.stderr, /acting as: noemi-agent/);
});
