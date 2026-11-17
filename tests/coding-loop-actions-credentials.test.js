'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const creds = require('../coding-loop/actions-credentials.js');

const root = path.join(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/coding-loop.yml'), 'utf8');
const caller = fs.readFileSync(path.join(root, 'templates/ci/coding-loop-caller.yml'), 'utf8');

function runMain(args, env) {
  const stdout = [];
  const stderr = [];
  const code = creds.main(['node', 'actions-credentials.js', ...args], env, {
    stdout: { write: (chunk) => stdout.push(String(chunk)) },
    stderr: { write: (chunk) => stderr.push(String(chunk)) },
  });
  return { code, stdout: stdout.join(''), stderr: stderr.join('') };
}

test('credential mode fails closed when only one Infisical variable is set', () => {
  assert.equal(creds.resolveCredentialMode('', ''), 'direct');
  assert.equal(creds.resolveCredentialMode('  ', '\n'), 'direct');
  assert.equal(creds.resolveCredentialMode('project', 'identity'), 'vault');
  assert.throws(() => creds.resolveCredentialMode('project', ''), /both INFISICAL_PROJECT_ID and INFISICAL_IDENTITY_ID/);
  assert.throws(() => creds.resolveCredentialMode('', 'identity'), (err) => err.code === 'vault-half-configured');
});

test('OIDC audience rejects characters that would change the token request', () => {
  assert.equal(creds.assertOidcAudience('infisical'), 'infisical');
  assert.equal(creds.assertOidcAudience('https://github.com/project-noemi'), 'https://github.com/project-noemi');
  assert.throws(() => creds.assertOidcAudience('infisical&audience=other'), (err) => err.code === 'oidc-audience');
  assert.throws(() => creds.assertOidcAudience(''), (err) => err.code === 'oidc-audience');
});

test('named reads stay on the four robot and model secrets at env dev path /', () => {
  for (const cli of ['current', 'legacy']) {
    const argv = creds.secretGetArgv({ name: 'AGENT_GH_TOKEN', projectId: 'project-id', cli });
    assert.equal(argv.includes('AGENT_GH_TOKEN'), true);
    assert.equal(argv.includes('--plain'), true);
    assert.equal(argv.includes('--silent'), true);
    assert.equal(argv.includes('--env=dev'), true);
    assert.equal(argv.includes('--path=/'), true);
    assert.equal(argv.includes('export'), false);
    assert.equal(argv.includes('run'), false);
    assert.equal(argv.some((part) => part.includes('recursive')), false);
    assert.equal(argv.join('\n').includes('CLASSIC'), false);
  }
  const current = creds.secretGetArgv({ name: 'AI_GW_API_TOKEN', projectId: 'abc', cli: 'current' });
  assert.deepEqual(current.slice(0, 3), ['secrets-manager', 'secrets', 'get']);
  assert.equal(current.includes('--secret-overriding=false'), true);
  const legacy = creds.secretGetArgv({ name: 'XAI_API_KEY', projectId: 'abc', cli: 'legacy' });
  assert.deepEqual(legacy.slice(0, 3), ['secrets', 'get', 'XAI_API_KEY']);
  assert.throws(() => creds.secretGetArgv({ name: 'AGENT_GH_TOKEN_CLASSIC', projectId: 'abc', cli: 'current' }), (err) => err.code === 'secret-not-allowlisted');
  assert.throws(() => creds.secretGetArgv({ name: 'NOEMI_CLIENT_REGISTRY', projectId: 'abc', cli: 'legacy' }), (err) => err.code === 'secret-not-allowlisted');
  assert.throws(() => creds.secretGetArgv({ name: 'AGENT_GH_TOKEN', projectId: 'not an id', cli: 'current' }), (err) => err.code === 'project-id' && !err.message.includes('not an id'));
  assert.throws(() => creds.secretGetArgv({ name: 'AGENT_GH_TOKEN', projectId: 'abc', cli: 'other' }), (err) => err.code === 'cli-shape');
});

test('plain reads treat the documented miss as absent and refuse unmaskable values', () => {
  assert.deepEqual(creds.classifyPlainOutput(''), { status: 'absent', value: '' });
  assert.deepEqual(creds.classifyPlainOutput('*not found*'), { status: 'absent', value: '' });
  assert.deepEqual(creds.classifyPlainOutput('github_pat_example'), { status: 'present', value: 'github_pat_example' });
  for (const bad of ['line\ntwo', 'has space', 'percent%value', 'mask::break', '*not found* ']) {
    assert.throws(() => creds.classifyPlainOutput(bad), (err) => err.code === 'secret-unexportable' && !err.message.includes(bad));
  }
});

test('producer login must be noemi-agent and the rejection does not echo the observed login', () => {
  assert.doesNotThrow(() => creds.assertProducerLogin('noemi-agent'));
  assert.throws(() => creds.assertProducerLogin(''), (err) => err.code === 'producer-login');
  for (const login of ['other-user', 'cursor[bot]', 'github_pat_example']) {
    assert.throws(
      () => creds.assertProducerLogin(login),
      (err) => err.code === 'producer-login'
        && err.message === 'Producer token login is not noemi-agent.'
        && !err.message.includes(login),
    );
  }
});

test('vault mode does not fall back to direct secrets or pass through other names', () => {
  const selected = creds.credentialsForRun({
    mode: 'vault',
    direct: { AGENT_GH_TOKEN: 'direct-token', AI_GW_API_TOKEN: 'direct-model' },
    vault: {
      AGENT_GH_TOKEN: 'vault-token',
      AI_GW_API_KEY: '*not found*',
      XAI_API_KEY: '',
      AGENT_GH_TOKEN_CLASSIC: 'classic-token',
      NOEMI_CLIENT_REGISTRY: '{"rows":[]}',
    },
  });
  assert.deepEqual(selected, {
    AGENT_GH_TOKEN: 'vault-token',
    AI_GW_API_TOKEN: '',
    AI_GW_API_KEY: '',
    XAI_API_KEY: '',
  });
  const direct = creds.credentialsForRun({
    mode: 'direct',
    direct: { AGENT_GH_TOKEN: 'direct-token', XAI_API_KEY: 'xai' },
    vault: { AGENT_GH_TOKEN: 'vault-token' },
  });
  assert.equal(direct.AGENT_GH_TOKEN, 'direct-token');
  assert.equal(direct.XAI_API_KEY, 'xai');
  assert.equal(direct.AI_GW_API_TOKEN, '');
  assert.throws(() => creds.credentialsForRun({ mode: 'other', direct: {}, vault: {} }), (err) => err.code === 'bad-mode');
});

test('CLI commands print status only and never the fetched value', () => {
  const secret = 'github_pat_examplevalue';
  const present = runMain(['--classify'], { FETCHED_PLAIN: secret });
  assert.equal(present.code, 0);
  assert.equal(present.stdout, 'present\n');
  assert.equal(present.stderr, '');
  assert.equal(present.stdout.includes(secret), false);

  const absent = runMain(['--classify'], { FETCHED_PLAIN: '*not found*' });
  assert.equal(absent.code, 0);
  assert.equal(absent.stdout, 'absent\n');

  const refused = runMain(['--classify'], { FETCHED_PLAIN: 'bad value with spaces' });
  assert.equal(refused.code, 1);
  assert.equal(refused.stdout, '');
  assert.equal(refused.stderr.includes('bad value'), false);

  const login = runMain(['--assert-login'], { LOGIN_TO_ASSERT: 'someone-else' });
  assert.equal(login.code, 1);
  assert.equal(login.stderr.includes('someone-else'), false);
  assert.equal(runMain(['--assert-login'], { LOGIN_TO_ASSERT: 'noemi-agent' }).code, 0);

  const names = runMain(['--secret-names'], {});
  assert.equal(names.code, 0);
  assert.deepEqual(names.stdout.trim().split('\n'), [...creds.SECRET_NAMES]);
  assert.equal(names.stdout.includes('CLASSIC'), false);

  const argv = runMain(['--secret-argv', 'AI_GW_API_KEY'], {
    INFISICAL_PROJECT_ID: 'project-id',
    INFISICAL_CLI_SHAPE: 'legacy',
  });
  assert.equal(argv.code, 0);
  assert.equal(argv.stdout.includes('--path=/'), true);
  assert.equal(argv.stdout.includes('AI_GW_API_KEY'), true);

  const half = runMain(['--mode-only'], { INFISICAL_PROJECT_ID: 'only-project' });
  assert.equal(half.code, 1);
  assert.match(half.stderr, /both INFISICAL_PROJECT_ID and INFISICAL_IDENTITY_ID/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-loop-mode-'));
  const output = path.join(dir, 'github-output');
  try {
    const mode = runMain(['--mode-only'], {
      INFISICAL_PROJECT_ID: 'project',
      INFISICAL_IDENTITY_ID: 'identity',
      GITHUB_OUTPUT: output,
    });
    assert.equal(mode.code, 0);
    assert.equal(mode.stdout, '');
    assert.equal(fs.readFileSync(output, 'utf8'), 'mode=vault\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('coding-loop workflow fetches named vault secrets and checks noemi-agent before the loop', () => {
  assert.match(workflow, /node coding-loop\/actions-credentials\.js --mode-only/);
  assert.match(workflow, /node coding-loop\/actions-credentials\.js --check-audience/);
  assert.match(workflow, /node coding-loop\/actions-credentials\.js --secret-names/);
  assert.match(workflow, /node coding-loop\/actions-credentials\.js --secret-argv/);
  assert.match(workflow, /node coding-loop\/actions-credentials\.js --classify/);
  assert.match(workflow, /node coding-loop\/actions-credentials\.js --assert-login/);
  assert.match(workflow, /infisical login --method=oidc-auth/);
  assert.match(workflow, /--machine-identity-id="\$INFISICAL_IDENTITY_ID"/);
  assert.match(workflow, /--jwt="\$JWT"/);
  assert.match(workflow, /--plain --silent/);
  assert.match(workflow, /echo "::add-mask::\$JWT"/);
  assert.match(workflow, /echo "::add-mask::\$access"/);
  assert.match(workflow, /echo "::add-mask::\$raw"/);
  assert.match(workflow, /AGENT_GH_TOKEN=""\n\s+AI_GW_API_TOKEN=""\n\s+AI_GW_API_KEY=""\n\s+XAI_API_KEY=""/);
  assert.match(workflow, /node coding-loop\/actions-credentials\.js --producer-name/);
  assert.match(workflow, /GH_TOKEN="\$producer_token" gh api user --jq \.login/);
  assert.match(workflow, /AGENT_GH_USE_CLASSIC: \$\{\{ vars\.AGENT_GH_USE_CLASSIC \}\}/);
  assert.match(workflow, /AGENT_GH_TOKEN_CLASSIC: \$\{\{ secrets\.AGENT_GH_TOKEN_CLASSIC \}\}/);
  assert.match(workflow, /AGENT_GH_TOKEN\|AGENT_GH_TOKEN_CLASSIC\|AI_GW_API_TOKEN\|AI_GW_API_KEY\|XAI_API_KEY\) ;;/);
  assert.match(workflow, /XAI_API_KEY=""\n\s+AGENT_GH_TOKEN_CLASSIC=""/);
  assert.match(workflow, /unset access/);
  assert.match(workflow, /unset INFISICAL_TOKEN/);
  assert.doesNotMatch(workflow, /^\s*secrets:\s*inherit\s*$/m);
  assert.doesNotMatch(workflow, /GITHUB_ENV/);
  assert.doesNotMatch(workflow, /infisical export/);
  assert.doesNotMatch(workflow, /^\s*infisical run\b/m);
  assert.doesNotMatch(workflow, /AGENT_GH_TOKEN_CLASSIC:-\$AGENT_GH_TOKEN|AGENT_GH_TOKEN:-\$AGENT_GH_TOKEN_CLASSIC/);
  assert.doesNotMatch(workflow, /echo "\$producer_token"/);
  assert.doesNotMatch(workflow, /echo "\$raw"/);
  assert.doesNotMatch(workflow, /echo "\$access"/);
  assert.doesNotMatch(workflow, /echo "\$JWT"/);
  assert.doesNotMatch(workflow, /echo "\$AGENT_GH_TOKEN"/);
  const assertAt = workflow.indexOf('--assert-login');
  const runAt = workflow.indexOf('node coding-loop/run.js');
  assert.ok(assertAt > 0 && runAt > assertAt, 'producer login is checked before the loop runs');
  assert.match(caller, /vault mode/i);
  assert.doesNotMatch(caller, /^\s*secrets:\s*inherit\s*$/m);
});

test('AGENT_GH_USE_CLASSIC selects the classic producer secret in both modes and never falls back', () => {
  const classic = { AGENT_GH_USE_CLASSIC: 'true' };
  assert.equal(creds.producerSecretName({}), 'AGENT_GH_TOKEN');
  assert.equal(creds.producerSecretName(classic), 'AGENT_GH_TOKEN_CLASSIC');
  assert.deepEqual(creds.secretNamesFor({}), [...creds.SECRET_NAMES]);
  assert.deepEqual(creds.secretNamesFor(classic), ['AGENT_GH_TOKEN_CLASSIC', 'AI_GW_API_TOKEN', 'AI_GW_API_KEY', 'XAI_API_KEY']);

  const argv = creds.secretGetArgv({ name: 'AGENT_GH_TOKEN_CLASSIC', projectId: 'abc', cli: 'current', env: classic });
  assert.equal(argv.includes('AGENT_GH_TOKEN_CLASSIC'), true);
  assert.equal(argv.includes('--env=dev'), true);
  assert.throws(() => creds.secretGetArgv({ name: 'AGENT_GH_TOKEN', projectId: 'abc', cli: 'current', env: classic }), (err) => err.code === 'secret-not-allowlisted');

  const vault = creds.credentialsForRun({
    mode: 'vault',
    direct: { AGENT_GH_TOKEN: 'direct-fine', AGENT_GH_TOKEN_CLASSIC: 'direct-classic' },
    vault: { AGENT_GH_TOKEN: 'vault-fine', AGENT_GH_TOKEN_CLASSIC: 'vault-classic' },
    env: classic,
  });
  assert.deepEqual(vault, {
    AGENT_GH_TOKEN_CLASSIC: 'vault-classic',
    AI_GW_API_TOKEN: '',
    AI_GW_API_KEY: '',
    XAI_API_KEY: '',
  });
  const direct = creds.credentialsForRun({
    mode: 'direct',
    direct: { AGENT_GH_TOKEN: 'direct-fine', AGENT_GH_TOKEN_CLASSIC: 'direct-classic' },
    vault: {},
    env: classic,
  });
  assert.equal(direct.AGENT_GH_TOKEN_CLASSIC, 'direct-classic');
  assert.equal(Object.prototype.hasOwnProperty.call(direct, 'AGENT_GH_TOKEN'), false);

  const names = runMain(['--secret-names'], classic);
  assert.equal(names.code, 0);
  assert.deepEqual(names.stdout.trim().split('\n'), ['AGENT_GH_TOKEN_CLASSIC', 'AI_GW_API_TOKEN', 'AI_GW_API_KEY', 'XAI_API_KEY']);
  assert.equal(runMain(['--producer-name'], classic).stdout, 'AGENT_GH_TOKEN_CLASSIC\n');
  assert.equal(runMain(['--producer-name'], {}).stdout, 'AGENT_GH_TOKEN\n');
  const refused = runMain(['--secret-argv', 'AGENT_GH_TOKEN'], { ...classic, INFISICAL_PROJECT_ID: 'project-id' });
  assert.equal(refused.code, 1);

  assert.match(caller, /AGENT_GH_TOKEN_CLASSIC: \$\{\{ secrets\.AGENT_GH_TOKEN_CLASSIC \}\}/);
  assert.match(caller, /AGENT_GH_USE_CLASSIC/);
});
