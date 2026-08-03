#!/usr/bin/env node
/**
 * agent-pr.js
 * Open a pull request as the NoéMI machine identity from environments where
 * the `gh` CLI is unavailable (e.g., containerized remote agent sessions).
 *
 * WHY THIS EXISTS
 *   `scripts/agent-gh.sh` is the canonical wrapper for authoring agent PRs as
 *   `noemi-agent`, but it requires the `gh` CLI and a vault CLI (infisical/op)
 *   on the host. Remote sandbox containers typically have neither — only
 *   Node.js and outbound HTTPS. Without a no-`gh` path, sessions in those
 *   environments silently fall back to the human's credentials, producing
 *   PRs the human cannot approve (see docs/MACHINE_IDENTITY.md).
 *
 * TOKEN RESOLUTION
 *   `AGENT_GH_TOKEN` is read from process memory only (Fetch-on-Demand,
 *   AGENTS.md): inject it via the remote environment's secret settings, or
 *   wrap locally with `infisical run --env=dev --` / `op run --env-file=.env.template --`.
 *   The token is never written to disk, never logged, and never echoed.
 *
 * IDENTITY GUARD
 *   The token is resolved against GET /user and must match
 *   `AGENT_GH_EXPECTED_LOGIN` (default: `noemi-agent`). If it resolves to any
 *   other account — especially a human's — the script refuses to act, because
 *   a mis-authored PR is the failure this tool exists to prevent.
 *
 * USAGE
 *   node scripts/agent-pr.js whoami
 *   node scripts/agent-pr.js create \
 *     --repo owner/name --base develop --head my-branch \
 *     --title "type(scope): subject" [--body "..." | --body-file path] \
 *     [--draft] [--supersede <pr-number> [--supersede-comment "..."]]
 *
 *   `--supersede N` closes PR N and posts a comment that links its
 *   replacement. Use it to re-author a PR that was accidentally opened under
 *   a human identity. Re-authoring normally reuses the predecessor's head
 *   branch, and GitHub refuses a second open PR on the same head+base — in
 *   that case PR N is verified to be the colliding PR and closed first;
 *   otherwise it is closed only after the replacement exists.
 *
 * See docs/MACHINE_IDENTITY.md for provisioning and least-privilege scoping.
 */

const { withRetry } = require('./resilience_helpers');

const API_BASE = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
const EXPECTED_LOGIN = process.env.AGENT_GH_EXPECTED_LOGIN || 'noemi-agent';

const auditLog = {
  task: 'Author pull request under the noemi-agent machine identity',
  inputs: [],
  actions: [],
  risks: [],
  result: 'not started',
};

function log(msg) {
  process.stderr.write(`${msg}\n`);
}

function emitAudit() {
  process.stderr.write(`${JSON.stringify(auditLog)}\n`);
}

function fail(msg, { risk } = {}) {
  log(`✖ ${msg}`);
  if (risk) auditLog.risks.push(risk);
  auditLog.result = `failed: ${msg}`;
  emitAudit();
  process.exit(1);
}

function resolveToken() {
  const token = process.env.AGENT_GH_TOKEN;
  if (!token) {
    fail(
      'Could not resolve the machine-identity token.\n' +
        '  AGENT_GH_TOKEN is not present in the environment.\n' +
        '  Inject it via the remote environment secret settings, or wrap the command:\n' +
        '    infisical run --env=dev -- node scripts/agent-pr.js ...\n' +
        '    op run --env-file=.env.template -- node scripts/agent-pr.js ...\n' +
        '  Provision per docs/MACHINE_IDENTITY.md. Do NOT paste the token into a chat\n' +
        '  session or commit it to the repo. Do NOT fall back to human credentials.',
      { risk: 'machine token unavailable; refused rather than authoring as a human' }
    );
  }
  return token;
}

async function ghRequest(token, method, path, body) {
  const doCall = async () => {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'noemi-agent-pr-script',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    // Per mcp-protocols/github.md §2: on rate limiting, respect the reset
    // timestamp; withRetry supplies the exponential backoff between attempts.
    if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')) {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const waitMs = Number.isFinite(reset) ? Math.max(0, reset * 1000 - Date.now()) : 0;
      const err = new Error(`rate limited (${res.status}); reset in ~${Math.ceil(waitMs / 1000)}s`);
      err.retryable = true;
      throw err;
    }
    if (res.status >= 500) {
      const err = new Error(`GitHub API ${res.status} on ${method} ${path}`);
      err.retryable = true;
      throw err;
    }

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      // 422s carry their actionable detail in the errors array, not message
      // (e.g. "A pull request already exists for owner:branch.").
      let detail = json && json.message ? json.message : text.slice(0, 200);
      if (json && Array.isArray(json.errors) && json.errors.length) {
        const extra = json.errors
          .map((e) => (typeof e === 'string' ? e : e.message || JSON.stringify(e)))
          .join('; ');
        detail += ` — ${extra}`;
      }
      const err = new Error(`GitHub API ${res.status} on ${method} ${path}: ${detail}`);
      err.retryable = false;
      throw err;
    }
    return json;
  };

  return withRetry(doCall, { maxRetries: 3, retryIf: (err) => err.retryable === true });
}

async function verifyIdentity(token) {
  let user;
  try {
    user = await ghRequest(token, 'GET', '/user');
  } catch (err) {
    fail(`Machine token was rejected by GitHub (expired, revoked, or wrong scopes): ${err.message}`, {
      risk: 'token rejected by GitHub',
    });
  }
  if (user.login !== EXPECTED_LOGIN) {
    fail(
      `Token resolves to '${user.login}', expected '${EXPECTED_LOGIN}'.\n` +
        '  Refusing to act — this would author agent work under the wrong identity.',
      { risk: `token resolved to unexpected identity '${user.login}'` }
    );
  }
  log(`→ acting as: ${user.login} (${user.type})`);
  auditLog.actions.push(`verified token identity: ${user.login}`);
  return user;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--draft') {
      args.draft = true;
    } else if (a.startsWith('--')) {
      args[a.slice(2)] = argv[++i];
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function cmdCreate(token, args) {
  const { repo, base, head, title } = args;
  for (const [name, val] of Object.entries({ repo, base, head, title })) {
    if (!val) fail(`Missing required flag --${name}. See the usage header of this script.`);
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    fail(`--repo must be in owner/name form, got '${repo}'.`);
  }

  let body = args.body || '';
  if (args['body-file']) {
    body = require('fs').readFileSync(args['body-file'], 'utf8');
  }

  const oldNumber = args.supersede ? Number(args.supersede) : null;
  if (args.supersede && (!Number.isInteger(oldNumber) || oldNumber <= 0)) {
    fail(`--supersede must be a PR number, got '${args.supersede}'.`);
  }

  auditLog.inputs.push(`repo: ${repo}`, `base: ${base}`, `head: ${head}`, `title: ${title}`);

  const createPayload = { title, head, base, body, draft: Boolean(args.draft) };
  let pr;
  let closedEarly = false;
  try {
    pr = await ghRequest(token, 'POST', `/repos/${repo}/pulls`, createPayload);
  } catch (err) {
    // Same-branch supersession: GitHub refuses a second open PR on the same
    // head+base, so the predecessor must be closed before its replacement can
    // exist. Only close it after verifying it IS the colliding PR — closing
    // an unrelated PR on a 422 would be worse than failing.
    if (!oldNumber || !/pull request already exists/i.test(err.message)) throw err;
    const owner = repo.split('/')[0];
    const colliding = await ghRequest(
      token,
      'GET',
      `/repos/${repo}/pulls?state=open&base=${encodeURIComponent(base)}&head=${encodeURIComponent(`${owner}:${head}`)}`
    );
    if (!Array.isArray(colliding) || colliding.length !== 1 || colliding[0].number !== oldNumber) {
      const found = Array.isArray(colliding) ? colliding.map((p) => `#${p.number}`).join(', ') : 'none';
      fail(
        `Head '${head}' already has an open PR against '${base}' (${found}), which is not --supersede ${oldNumber}.\n` +
          '  Refusing to close a PR that was not named for supersession.',
        { risk: `head+base collision with a PR other than the supersede target (${found})` }
      );
    }
    await ghRequest(token, 'PATCH', `/repos/${repo}/pulls/${oldNumber}`, { state: 'closed' });
    closedEarly = true;
    log(`✔ closed superseded PR #${oldNumber} (it held the same head+base as its replacement)`);
    auditLog.actions.push(`closed superseded PR #${oldNumber} before create (same head+base)`);
    pr = await ghRequest(token, 'POST', `/repos/${repo}/pulls`, createPayload);
  }
  log(`✔ opened PR #${pr.number}: ${pr.html_url}`);
  auditLog.actions.push(`opened PR #${pr.number} (${pr.html_url})`);

  if (oldNumber) {
    const comment =
      args['supersede-comment'] ||
      `Superseded by #${pr.number}, re-authored under the \`${EXPECTED_LOGIN}\` machine identity so a human reviewer can approve it (see \`docs/MACHINE_IDENTITY.md\`). — ${EXPECTED_LOGIN}`;
    await ghRequest(token, 'POST', `/repos/${repo}/issues/${oldNumber}/comments`, { body: comment });
    if (!closedEarly) {
      await ghRequest(token, 'PATCH', `/repos/${repo}/pulls/${oldNumber}`, { state: 'closed' });
    }
    log(`✔ ${closedEarly ? 'commented on' : 'commented on and closed'} superseded PR #${oldNumber}`);
    auditLog.actions.push(
      closedEarly
        ? `commented replacement link on superseded PR #${oldNumber}`
        : `commented on and closed superseded PR #${oldNumber}`
    );
  }

  auditLog.result = `PR #${pr.number} opened as ${EXPECTED_LOGIN}`;
  emitAudit();
  // The new PR URL is the machine-readable payload; everything else went to stderr.
  process.stdout.write(`${pr.html_url}\n`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const token = resolveToken();

  if (command === 'whoami') {
    const user = await ghRequest(token, 'GET', '/user').catch((err) =>
      fail(`Machine token was rejected by GitHub: ${err.message}`)
    );
    auditLog.task = 'Verify which identity the machine token resolves to';
    auditLog.actions.push(`resolved token identity: ${user.login}`);
    auditLog.result = `${user.login} (${user.type})`;
    emitAudit();
    process.stdout.write(`${user.login} (${user.type})\n`);
    return;
  }

  if (command === 'create') {
    const args = parseArgs(rest);
    await verifyIdentity(token);
    await cmdCreate(token, args);
    return;
  }

  fail(
    `Unknown command '${command || ''}'. Supported: whoami, create.\n` +
      '  Example:\n' +
      '    node scripts/agent-pr.js create --repo owner/name --base develop \\\n' +
      '      --head my-branch --title "type(scope): subject" --body "..."'
  );
}

main().catch((err) => fail(err.message));
