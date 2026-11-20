#!/usr/bin/env node
'use strict';

/**
 * Fetch-on-Demand injector for Secret Manager (Google Cloud) and Azure Key Vault.
 *
 * A manifest names environment variables and vault resources. Values are read
 * into the child process environment and never written to a file or passed as
 * arguments. One launch uses one cloud. Infisical and 1Password keep their
 * own wrappers (`infisical run`, `op run`).
 */

const { spawnSync } = require('child_process');

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SM_RESOURCE = /^sm:\/\/([a-z][a-z0-9-]{4,28}[a-z0-9])\/([A-Za-z][A-Za-z0-9_-]{0,254})(?:\/(latest|[1-9][0-9]*))?$/;
const KV_RESOURCE = /^kv:\/\/([A-Za-z](?:[A-Za-z0-9-]{0,22}[A-Za-z0-9])?)\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,125}[A-Za-z0-9])?)(?:\/(latest|[0-9a-fA-F]{32}))?$/;

class ManifestError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ManifestError';
    this.code = code;
  }
}

function parseResource(raw) {
  const sm = SM_RESOURCE.exec(raw);
  if (sm) {
    return { cloud: 'sm', project: sm[1], secret: sm[2], version: sm[3] || 'latest' };
  }
  const kv = KV_RESOURCE.exec(raw);
  if (kv) {
    return { cloud: 'kv', vault: kv[1], secret: kv[2], version: (kv[3] || 'latest').toLowerCase() };
  }
  throw new ManifestError(
    'Resource must be sm://PROJECT/SECRET[/VERSION] or kv://VAULT/SECRET[/VERSION]. Got a value that is not a vault reference.',
    'bad-resource',
  );
}

function parseManifest(text) {
  const entries = [];
  const seen = new Set();
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) {
      throw new ManifestError(`Line ${i + 1} must be ENV_NAME=resource.`, 'bad-line');
    }
    const name = line.slice(0, eq).trim();
    const resource = line.slice(eq + 1).trim();
    if (!ENV_NAME.test(name)) {
      throw new ManifestError(`Line ${i + 1} has an invalid environment name.`, 'bad-name');
    }
    if (seen.has(name)) {
      throw new ManifestError(`Environment name ${name} is repeated.`, 'duplicate-name');
    }
    seen.add(name);
    const parsed = parseResource(resource);
    entries.push({ name, ...parsed });
  }
  if (entries.length === 0) {
    throw new ManifestError('Manifest names no secrets.', 'empty');
  }
  const clouds = new Set(entries.map((entry) => entry.cloud));
  if (clouds.size > 1) {
    throw new ManifestError(
      'One launch uses one cloud. Split Secret Manager and Key Vault names into two manifests.',
      'mixed-cloud',
    );
  }
  return entries;
}

function stripTrailingNewline(value) {
  return String(value).replace(/\r?\n$/, '');
}

function readSecretManager(entry, spawn) {
  const result = spawn('gcloud', [
    'secrets', 'versions', 'access', entry.version,
    `--secret=${entry.secret}`,
    `--project=${entry.project}`,
  ], { encoding: 'utf8' });
  if (!result || result.status !== 0) {
    throw new ManifestError(
      `Secret Manager read failed for ${entry.project}/${entry.secret} (exit ${result ? result.status : 'missing'}).`,
      'secret-read',
    );
  }
  return stripTrailingNewline(result.stdout || '');
}

function readKeyVault(entry, spawn) {
  const args = [
    'keyvault', 'secret', 'show',
    '--vault-name', entry.vault,
    '--name', entry.secret,
    '--query', 'value',
    '-o', 'tsv',
  ];
  if (entry.version !== 'latest') args.push('--version', entry.version);
  const result = spawn('az', args, { encoding: 'utf8' });
  if (!result || result.status !== 0) {
    throw new ManifestError(
      `Azure Key Vault read failed for ${entry.vault}/${entry.secret} (exit ${result ? result.status : 'missing'}).`,
      'secret-read',
    );
  }
  return stripTrailingNewline(result.stdout || '');
}

function defaultReaders(spawn) {
  return {
    sm: (entry) => readSecretManager(entry, spawn),
    kv: (entry) => readKeyVault(entry, spawn),
  };
}

function resolveEntries(entries, readers) {
  const resolved = [];
  for (const entry of entries) {
    const read = readers[entry.cloud];
    if (typeof read !== 'function') {
      throw new ManifestError(`No reader for ${entry.cloud}.`, 'no-reader');
    }
    let value;
    try {
      value = read(entry);
    } catch (err) {
      if (err instanceof ManifestError) throw err;
      throw new ManifestError(
        `Secret read failed for ${entry.cloud === 'sm' ? entry.project : entry.vault}/${entry.secret}.`,
        'secret-read',
      );
    }
    if (typeof value !== 'string' || value.length === 0) {
      throw new ManifestError(
        `Secret ${entry.cloud === 'sm' ? entry.project : entry.vault}/${entry.secret} was empty.`,
        'empty-secret',
      );
    }
    resolved.push({ name: entry.name, value });
  }
  return resolved;
}

function buildChildEnv(base, resolved) {
  const env = { ...base };
  for (const item of resolved) env[item.name] = item.value;
  return env;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let manifest = null;
  const command = [];
  let seenDash = false;
  for (let i = 0; i < args.length; i++) {
    if (!seenDash && args[i] === '--') {
      seenDash = true;
      continue;
    }
    if (seenDash) {
      command.push(args[i]);
      continue;
    }
    if (args[i] === '--manifest') {
      manifest = args[++i];
      continue;
    }
    throw new ManifestError('Usage: node scripts/secret-inject.js --manifest FILE -- command [args]', 'usage');
  }
  if (!manifest) throw new ManifestError('Missing --manifest.', 'usage');
  if (command.length === 0) throw new ManifestError('Missing command after --.', 'usage');
  return { manifest, command };
}

function main(argv, io) {
  const fs = io.fs || require('fs');
  const spawn = io.spawn || spawnSync;
  const readers = io.readers || defaultReaders(spawn);
  const parsed = parseArgs(argv);
  const text = fs.readFileSync(parsed.manifest, 'utf8');
  const entries = parseManifest(text);
  const resolved = resolveEntries(entries, readers);
  const env = buildChildEnv(io.env || process.env, resolved);
  const [cmd, ...cmdArgs] = parsed.command;
  const child = spawn(cmd, cmdArgs, { env, stdio: 'inherit' });
  const code = child && typeof child.status === 'number' ? child.status : 1;
  if (io.exit) io.exit(code);
  else process.exit(code);
}

module.exports = {
  ManifestError,
  parseManifest,
  parseResource,
  readSecretManager,
  readKeyVault,
  resolveEntries,
  buildChildEnv,
  parseArgs,
  main,
};

if (require.main === module) {
  try {
    main(process.argv, {});
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(err.code === 'usage' ? 2 : 1);
  }
}
