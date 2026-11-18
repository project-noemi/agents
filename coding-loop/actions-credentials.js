'use strict';

/**
 * Credential-source rules for the coding-loop GitHub Actions workflow.
 *
 * Vault mode reads four named secrets from Infisical (env `dev`, path `/`).
 * It does not export the folder. Direct mode keeps the Actions secrets the
 * caller already passes by name. A producer token is refused unless GitHub
 * reports the login `noemi-agent`.
 *
 * The Actions variable AGENT_GH_USE_CLASSIC (Decision [2026-11-10-0001])
 * selects the classic cross-organization producer token under the name
 * AGENT_GH_TOKEN_CLASSIC in both modes; the choice never falls back.
 *
 * This module never logs a secret value. Callers must not put one in an
 * error path.
 */

const fs = require('fs');
const { wantsClassic } = require('../scripts/agent-token.js');

const SECRET_NAMES = Object.freeze([
  'AGENT_GH_TOKEN',
  'AI_GW_API_TOKEN',
  'AI_GW_API_KEY',
  'XAI_API_KEY',
]);

const CLASSIC_PRODUCER_SECRET_NAME = 'AGENT_GH_TOKEN_CLASSIC';

/**
 * The producer secret name for this run: AGENT_GH_TOKEN for the home
 * organization, AGENT_GH_TOKEN_CLASSIC when the caller sets
 * AGENT_GH_USE_CLASSIC for a target outside it (scripts/agent-token.js applies
 * the same switch inside run.js). Never both, never a fallback.
 */
function producerSecretName(env = process.env) {
  return wantsClassic(env) ? CLASSIC_PRODUCER_SECRET_NAME : SECRET_NAMES[0];
}

/** The names this run may read: the producer name for the run, then the model keys. */
function secretNamesFor(env = process.env) {
  return [producerSecretName(env), ...SECRET_NAMES.slice(1)];
}

const NOT_FOUND_MARKER = '*not found*';
const EXPECTED_PRODUCER_LOGIN = 'noemi-agent';

function fail(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function resolveCredentialMode(projectId, identityId) {
  const project = String(projectId == null ? '' : projectId).trim();
  const identity = String(identityId == null ? '' : identityId).trim();
  if (project === '' && identity === '') return 'direct';
  if (project !== '' && identity !== '') return 'vault';
  throw fail(
    'Set both INFISICAL_PROJECT_ID and INFISICAL_IDENTITY_ID, or neither (direct mode).',
    'vault-half-configured',
  );
}

function assertOidcAudience(audience) {
  const value = String(audience == null ? '' : audience);
  if (!/^[A-Za-z0-9._:/+-]+$/.test(value)) {
    throw fail(
      'INFISICAL_OIDC_AUDIENCE contains characters the OIDC request cannot safely carry.',
      'oidc-audience',
    );
  }
  return value;
}

function assertSecretName(name, env = process.env) {
  if (!secretNamesFor(env).includes(name)) {
    throw fail('Refusing to read a secret outside the coding-loop allowlist.', 'secret-not-allowlisted');
  }
}

function assertProjectId(projectId) {
  const project = String(projectId == null ? '' : projectId).trim();
  if (!/^[A-Za-z0-9-]+$/.test(project)) {
    throw fail('INFISICAL_PROJECT_ID is missing or not a single id.', 'project-id');
  }
  return project;
}

/**
 * Argument vector for one named read.
 * `current` is `infisical secrets-manager secrets get` (CLI reference).
 * `legacy` is `infisical secrets get`, the form already used by the
 * reviewer workflows when the installed CLI has no `secrets-manager` verb.
 * Neither form omits the name, and neither is `export` or `run`.
 */
function secretGetArgv({
  name, projectId, cli, env = process.env,
}) {
  assertSecretName(name, env);
  const project = assertProjectId(projectId);
  const tail = [
    '--plain',
    '--silent',
    `--projectId=${project}`,
    '--env=dev',
    '--path=/',
  ];
  switch (cli) {
    case 'current':
      return ['secrets-manager', 'secrets', 'get', name, '--secret-overriding=false', ...tail];
    case 'legacy':
      return ['secrets', 'get', name, ...tail];
    default: {
      throw fail('Unsupported Infisical CLI shape.', 'cli-shape');
    }
  }
}

/**
 * Classify a `--plain` read. The documented missing-secret marker is absent.
 * Values that cannot be masked as one workflow command are refused.
 * The returned value is for the caller to mask and export; this function
 * does not write it anywhere.
 */
function classifyPlainOutput(text) {
  const value = String(text == null ? '' : text);
  if (value === '' || value === NOT_FOUND_MARKER) return { status: 'absent', value: '' };
  if (/[\s%]/.test(value) || value.includes('::')) {
    throw fail('Infisical returned a secret value that cannot be masked safely.', 'secret-unexportable');
  }
  return { status: 'present', value };
}

function assertProducerLogin(login) {
  if (login !== EXPECTED_PRODUCER_LOGIN) {
    throw fail(`Producer token login is not ${EXPECTED_PRODUCER_LOGIN}.`, 'producer-login');
  }
}

/**
 * The four names the loop may see for this run (secretNamesFor). Vault mode
 * does not fall back to the direct values, and the producer name not selected
 * by AGENT_GH_USE_CLASSIC is dropped like any other key outside the allowlist.
 */
function credentialsForRun({
  mode, direct, vault, env = process.env,
}) {
  let source;
  switch (mode) {
    case 'direct':
      source = direct || {};
      break;
    case 'vault':
      source = vault || {};
      break;
    default:
      throw fail('Credential mode must be direct or vault.', 'bad-mode');
  }
  const out = {};
  for (const name of secretNamesFor(env)) {
    const raw = Object.prototype.hasOwnProperty.call(source, name) && source[name] != null
      ? String(source[name])
      : '';
    out[name] = classifyPlainOutput(raw).value;
  }
  return out;
}

function writeMode(mode, env, io) {
  const line = `mode=${mode}\n`;
  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, line, { mode: 0o600 });
    return;
  }
  io.stdout.write(line);
}

function main(argv, env = process.env, io = { stdout: process.stdout, stderr: process.stderr }) {
  try {
    const command = argv[2];
    if (command === '--mode-only') {
      writeMode(resolveCredentialMode(env.INFISICAL_PROJECT_ID, env.INFISICAL_IDENTITY_ID), env, io);
      return 0;
    }
    if (command === '--check-audience') {
      assertOidcAudience(env.INFISICAL_OIDC_AUDIENCE);
      return 0;
    }
    if (command === '--secret-names') {
      io.stdout.write(`${secretNamesFor(env).join('\n')}\n`);
      return 0;
    }
    if (command === '--producer-name') {
      io.stdout.write(`${producerSecretName(env)}\n`);
      return 0;
    }
    if (command === '--secret-argv') {
      const cli = env.INFISICAL_CLI_SHAPE === 'legacy' ? 'legacy' : 'current';
      const args = secretGetArgv({
        name: argv[3],
        projectId: env.INFISICAL_PROJECT_ID,
        cli,
        env,
      });
      io.stdout.write(`${args.join('\n')}\n`);
      return 0;
    }
    if (command === '--classify') {
      const result = classifyPlainOutput(env.FETCHED_PLAIN);
      io.stdout.write(`${result.status}\n`);
      return 0;
    }
    if (command === '--assert-login') {
      assertProducerLogin(env.LOGIN_TO_ASSERT);
      return 0;
    }
    throw fail('Unknown coding-loop credential command.', 'bad-args');
  } catch (err) {
    const message = err && err.message ? err.message : 'credentials failed';
    io.stderr.write(`${message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  SECRET_NAMES,
  CLASSIC_PRODUCER_SECRET_NAME,
  producerSecretName,
  secretNamesFor,
  NOT_FOUND_MARKER,
  EXPECTED_PRODUCER_LOGIN,
  resolveCredentialMode,
  assertOidcAudience,
  secretGetArgv,
  classifyPlainOutput,
  assertProducerLogin,
  credentialsForRun,
  main,
};
