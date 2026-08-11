#!/usr/bin/env node
/**
 * Obtain a short-lived Google Cloud access token via Application Default
 * Credentials. No static credential is read, stored, or logged.
 *
 * WHY THERE IS NO API KEY PATH
 *   The `project-noemi` organization policy disallows API keys outright
 *   ("Your organization's security policy disallows API keys. Please use
 *   Application Default Credentials instead") AND disallows service-account
 *   key creation. So the two usual static-credential mechanisms are both
 *   unavailable, and ADC is not merely preferred — it is the only option.
 *
 *   This is a stronger posture than a vaulted key: the credential is
 *   short-lived, so there is nothing durable to leak or rotate. It also means
 *   Infisical stores nothing for Gemini, which is the correct reading of
 *   "use the vault wherever possible" rather than an exception to it.
 *
 * RESOLUTION ORDER
 *   1. $GCP_ACCESS_TOKEN — pre-injected. In GitHub Actions this comes from
 *      google-github-actions/auth with `token_format: access_token`, which
 *      obtains it through Workload Identity Federation (no key involved).
 *   2. `gcloud auth application-default print-access-token` — local
 *      development, after `gcloud auth application-default login`.
 *
 * The token is returned to the caller and never written to disk or stderr.
 */

'use strict';

const { execFile } = require('node:child_process');

/** Tokens are short-lived; cache within a process run only. */
let cached = null;

function fromGcloud() {
  return new Promise((resolve, reject) => {
    execFile(
      'gcloud',
      ['auth', 'application-default', 'print-access-token'],
      { timeout: 30_000 },
      (err, stdout, stderr) => {
        if (err) {
          const detail = String(stderr || err.message).trim();
          // Reauthentication is the common case and is not self-explanatory
          // from gcloud's message alone in a CI-style log.
          if (/[Rr]eauthentication|credentials/.test(detail)) {
            reject(new Error(
              'Application Default Credentials are missing or expired.\n'
              + '  Local:  gcloud auth application-default login\n'
              + '  CI:     use google-github-actions/auth (Workload Identity Federation)\n'
              + `  gcloud said: ${detail.split('\n')[0]}`,
            ));
            return;
          }
          reject(new Error(`Could not obtain an ADC access token: ${detail.split('\n')[0]}`));
          return;
        }
        const token = String(stdout).trim();
        if (!token) {
          reject(new Error('gcloud returned an empty access token.'));
          return;
        }
        resolve(token);
      },
    );
  });
}

/**
 * @returns {Promise<string>} a short-lived OAuth2 access token
 * @throws if no ADC source is available — deliberately loud, since silently
 *         proceeding without credentials produces a confusing 401 later.
 */
async function getAccessToken() {
  if (cached) return cached;

  if (process.env.GCP_ACCESS_TOKEN) {
    cached = process.env.GCP_ACCESS_TOKEN.trim();
    return cached;
  }

  cached = await fromGcloud();
  return cached;
}

/** Test seam: clear the in-process cache. */
function resetTokenCache() {
  cached = null;
}

/** Which source getAccessToken() will use, for diagnostics. Never the value. */
function tokenSource() {
  return process.env.GCP_ACCESS_TOKEN ? 'GCP_ACCESS_TOKEN' : 'gcloud-adc';
}

module.exports = { getAccessToken, resetTokenCache, tokenSource };

if (require.main === module) {
  // Reports the SOURCE, never the token — printing a credential to stdout is
  // how it ends up in a log.
  getAccessToken()
    .then(() => {
      process.stdout.write(`ADC token obtained via ${tokenSource()}\n`);
    })
    .catch((err) => {
      process.stderr.write(`✖ ${err.message}\n`);
      process.exit(2);
    });
}
