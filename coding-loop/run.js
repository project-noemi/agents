#!/usr/bin/env node
'use strict';

/**
 * Issue-coding loop entry (Stages A–C).
 *
 * USAGE
 *   node coding-loop/run.js --repo org/name --issue 12
 *   node coding-loop/run.js --repo org/name --issue 12 --post
 *   node coding-loop/run.js --repo org/name --issue 12 --implement
 *   node coding-loop/run.js --repo org/name --issue 12 --implement --open-pr
 *
 * --post requires CONDUCTOR_GH_TOKEN or CONDUCTOR_APP_ID+CONDUCTOR_APP_PRIVATE_KEY.
 * --implement / --open-pr require AGENT_GH_TOKEN (or AGENT_GH_TOKEN_CLASSIC
 * when AGENT_GH_USE_CLASSIC=1).
 * --open-pr also requires a writer credential, then opens the PR.
 * Model route (scripts/model-config.js): AI_GW_API_TOKEN (or AI_GW_API_KEY)
 * sends the writer and --live-critic through the NewPush AI gateway, with
 * AI_GW_BASE_URL optional. Without a gateway key the writer needs XAI_API_KEY
 * and --live-critic needs ADC (GCP_ACCESS_TOKEN or gcloud) for Vertex Gemini.
 *
 * Two-step runs (a host that shows the plan before implementing it, such as
 * NoéMi Code's /issue):
 *   --plan-out FILE  write the Stage A/B result after B′ (mode 0600)
 *   --plan-in FILE   skip Stage A/B and implement that accepted plan. Refused
 *                    when the plan was not accepted, names another issue,
 *                    or the issue title/body changed after it was planned.
 *                    Every deterministic Stage A gate (skip, bot, empty,
 *                    entitlement + requester, budget, scan) runs again.
 *
 * Every run needs --requested-by naming a user with write access to the
 * repo (tenant and client alike); without it the issue is REFUSED
 * `trigger-unverified`. Client orgs (not on the tenant's `orgs` list) are
 * entitled only when the conductor App is installed there and
 * NOEMI_CLIENT_REGISTRY has an active row for that account
 * (coding-loop/entitlement.js, Decision [2026-10-22-0005]).
 *
 * GitHub Enterprise Server: GITHUB_API_URL (https only) is honoured for the
 * loop's own GitHub calls.
 *
 * Forges: every forge call goes through a provider (coding-loop/providers/).
 * `--repo owner/name` is GitHub, as it always was; `github:owner/name` and
 * repository URLs also work, and other forges use `<provider>:<path>` once
 * their provider is registered. `--item` is an alias for `--issue`.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { gh, githubApiBase } = require('../scripts/github-client.js');
const {
  REQUESTER_REFUSALS, classifyIssue, entitlementGate,
} = require('./intake.js');
const { parseRepoRef, getProvider } = require('./providers/index.js');
const {
  createGithubProvider, githubCredential, issueRepoOf,
} = require('./providers/github/index.js');
const { completeThroughStageB, critiquePlan, loadRouting } = require('./plan.js');
const { openImplementationPr, prepareImplementation } = require('./dispatch.js');
const { critiquePlanLive, revisePlanLive } = require('./critic.js');
const { assertWriterKey, draftChanges } = require('./writer.js');
const { scanIssueBody, scanOutboundText } = require('./scan.js');
const { loadModelConfig } = require('../scripts/model-config.js');
const { prepareReview } = require('./stage-d.js');
const { resolveProfile } = require('./profile.js');

const repoRoot = path.join(__dirname, '..');

const USAGE = 'Usage: coding-loop/run.js --repo owner/name --issue N (alias --item N) --requested-by login [--post] [--implement] [--open-pr] [--live-critic] [--profile code|spec] [--tenant path] [--plan-out file | --plan-in file] (--scan | --scan-status APPROVED|BLOCKED|REDACTED) (--budget-ok | --budget-exhausted)\n'
  + 'Omitting both --scan and --scan-status, omitting the budget assertion, or omitting --requested-by classifies the issue as REFUSED (fail closed).\n'
  + '--requested-by names the person who triggered the run; they need write, maintain or admin on the repo. Never the bot.\n'
  + '--scan runs coding-loop/scan.js on the fetched issue; it is not implied by omitting --scan-status.\n'
  + '--profile spec constrains Stage B/C to markdown under agents/, skills/, docs/agents/ (writing personas and skills).\n'
  + '--implement prepares a noemi-agent PR envelope.\n'
  + '--open-pr (with --implement) drafts files via Grok and opens the PR as noemi-agent.\n'
  + '--live-critic runs Gemini Pro for Stage B′ (gateway key, else Vertex ADC); without it B′ is structural only.\n'
  + 'Orgs outside the tenant need the conductor App installed and an active row in NOEMI_CLIENT_REGISTRY.\n'
  + '--plan-out writes the accepted-or-not plan to a file; --plan-in implements that accepted plan without planning again.\n';

/** Flags that take a value, and the args field each one sets. */
const VALUE_FLAGS = {
  '--repo': 'repo',
  '--issue': 'issue',
  '--item': 'issue',
  '--tenant': 'tenantPath',
  '--requested-by': 'requestedBy',
  '--scan-status': 'scanStatus',
  '--profile': 'profile',
  '--plan-out': 'planOut',
  '--plan-in': 'planIn',
};

// What --scan-status may assert. Anything else is a typo or an error state
// from the caller's scanner, and is refused here AND in the classifier.
const SCAN_STATUS_VALUES = new Set(['APPROVED', 'REDACTED', 'BLOCKED']);
const GITHUB_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\[bot\])?$/;

/** A CLI usage refusal. main() exits 2 for these (status 2). */
function usageError(message) {
  const err = new Error(message);
  err.status = 2;
  return err;
}

function parseArgs(argv) {
  // No permissive defaults: security gates fail CLOSED. A scan status exists
  // only if a scanner produced one (--scan-status, or --scan which runs the
  // local scanner), and budget capacity exists only if the caller checked it
  // — filling either in because the flag was omitted was a critical review
  // finding (fail-open by omission).
  //
  // Throws (status 2) instead of exiting so tests can call it. A value flag
  // whose value is missing or is the next flag is refused: `--requested-by
  // --post` used to set requestedBy to "--post" and swallow the flag.
  const args = {
    post: false,
    implement: false,
    openPr: false,
    liveCritic: false,
    scan: false,
    scanStatus: null,
    budgetState: null,
    profile: 'code',
  };
  const list = Array.isArray(argv) ? argv : [];
  for (let i = 0; i < list.length; i += 1) {
    const flag = String(list[i]);
    if (Object.prototype.hasOwnProperty.call(VALUE_FLAGS, flag)) {
      const value = list[i + 1];
      if (value === undefined || value === null || String(value) === '' || String(value).startsWith('--')) {
        throw usageError(`${flag} needs a value.`);
      }
      i += 1;
      args[VALUE_FLAGS[flag]] = String(value);
      continue;
    }
    switch (flag) {
      case '--post': args.post = true; break;
      case '--implement': args.implement = true; break;
      case '--open-pr': args.openPr = true; break;
      case '--live-critic': args.liveCritic = true; break;
      case '--heuristic-critic': args.liveCritic = false; break;
      case '--scan': args.scan = true; break;
      case '--budget-ok': args.budgetState = 'ok'; break;
      case '--budget-exhausted': args.budgetState = 'exhausted'; break;
      case '--help': args.help = true; break;
      default:
        if (flag.startsWith('--')) throw usageError(`Unknown flag: ${flag}`);
    }
  }
  if (args.requestedBy !== undefined) {
    args.requestedBy = args.requestedBy.replace(/^@/, '');
    if (!GITHUB_LOGIN_RE.test(args.requestedBy)) {
      throw usageError('--requested-by must be a GitHub login.');
    }
  }
  if (args.scanStatus !== null && !SCAN_STATUS_VALUES.has(args.scanStatus)) {
    throw usageError('--scan-status must be exactly APPROVED, REDACTED or BLOCKED.');
  }
  return args;
}
/**
 * A repository reference and a positive item id — refuse anything that
 * would change the forge API path (extra slashes, `..`, non-digits). The
 * provider that owns the reference does the validation (status 400);
 * returns `{ ref, id, provider }`.
 */
function assertRepoIssue(repo, issue, { env = process.env } = {}) {
  const ref = parseRepoRef(typeof repo === 'string' ? repo : '', { env });
  const provider = getProvider(ref.provider);
  const id = provider.parseItemId(issue);
  return { ref, id, provider };
}

/**
 * Translate CLI assertions into classifier inputs. Anything not explicitly
 * asserted is passed as null so classifyIssue's own fail-closed paths fire —
 * the enforcement point is the classifier, never this wrapper.
 */
function buildGateInputs(args) {
  return {
    scan: args.scanStatus ? { status: args.scanStatus } : null,
    budget: args.budgetState ? { exhausted: args.budgetState === 'exhausted' } : null,
  };
}

/**
 * Scan result for classifyIssue. `--scan-status` is a precomputed result.
 * `--scan` runs the local scanner on the fetched issue. Omitting both
 * leaves `null` so the classifier refuses (unscanned-body). This is the
 * function `main()` uses — do not "helpfully" scan when neither flag is set.
 */
function resolveScanInput(args, issue) {
  if (args && args.scanStatus) {
    return { status: args.scanStatus };
  }
  if (args && args.scan) {
    return scanIssueBody(scanText(issue));
  }
  return null;
}

/**
 * What the scanner sees: title, body and the provider's hiddenText (text a
 * human reader may not see but a model would be fed). Unchanged for GitHub,
 * whose hiddenText is always empty.
 */
function scanText(issue) {
  const base = `${(issue && issue.title) || ''}\n${(issue && issue.body) || ''}`;
  const hidden = String((issue && issue.hiddenText) || '');
  return hidden ? `${base}\n${hidden}` : base;
}

function loadTenant(relPath) {
  const file = path.resolve(repoRoot, relPath || 'tenants/internal.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function conductorToken(env = process.env) {
  return (env && env.CONDUCTOR_GH_TOKEN) || '';
}

/** GitHub conductor token as a string (pre-provider export; run.js uses resolveCredential). */
async function resolveConductorToken(env = process.env, { owner, mint } = {}) {
  const cred = await createGithubProvider({ mint }).resolveCredential({
    role: 'conductor', ref: { owner }, env,
  });
  return cred ? cred.token : '';
}

function readToken(env = process.env) {
  return conductorToken(env)
    || (env && env.GH_TOKEN)
    || (env && env.GITHUB_TOKEN)
    || '';
}

// Reads use the conductor token already resolved above, including an
// installation token minted from the App. --post only controls the comment
// and the label; it must not be required to keep that token (Decision
// [2026-10-03-0002]).
function issueReadToken(conductor, env = process.env) {
  return conductor || readToken(env);
}

// Version 3 adds `provider` and `repoKey`. Versions 1 and 2 are GitHub-only
// files and are still read (their `repo` slug is compared).
const PLAN_FILE_VERSION = 3;

/**
 * What a plan was made from: sha256 over the issue title and body.
 * Version 1 compared `updated_at`, which the conductor's own comment and
 * label bump — so `--plan-out` together with `--post` produced a plan that
 * could never be used. Labels and comments do not change the fingerprint;
 * an edit to the title or body does. `updatedAt` stays in the record as
 * information only.
 */
function issueFingerprint(issue) {
  const title = String((issue && issue.title) || '');
  const body = String((issue && issue.body) || '');
  // hiddenText is part of what was planned from; it joins the hash only
  // when present, so a GitHub fingerprint (and every v2 file) is unchanged.
  const hidden = String((issue && issue.hiddenText) || '');
  const parts = hidden ? [title, body, hidden] : [title, body];
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/**
 * Write without following a planted symlink and with 0600 from the first
 * byte. writeFileSync's `mode` applies only when it CREATES the file, and it
 * follows a symlink at the target: an existing world-readable file (or a
 * link to one) kept its mode and got the plan. So: refuse a symlink target,
 * write a fresh temp file in the same directory with O_EXCL ('wx') and
 * 0600, then rename it over the target (rename replaces, never follows).
 */
function writeFileAtomic0600(file) {
  return (text) => {
    let stat = null;
    try {
      stat = fs.lstatSync(file);
    } catch (err) {
      if (!err || err.code !== 'ENOENT') throw err;
    }
    if (stat && stat.isSymbolicLink()) {
      const err = new Error('--plan-out refused: the target is a symbolic link.');
      err.status = 409;
      throw err;
    }
    const dir = path.dirname(path.resolve(file));
    const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
      fs.writeFileSync(tmp, text, { flag: 'wx', mode: 0o600 });
      fs.renameSync(tmp, file);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* already gone */ }
      throw err;
    }
  };
}

/** The Stage A/B result a later --plan-in run implements unchanged. */
/** RepoRef for a plan-file call: the ref itself, or a GitHub-era `owner/name`. */
function planRefOf(ref, repo) {
  if (ref) return ref;
  try {
    return parseRepoRef(repo, { env: {} });
  } catch {
    return null;
  }
}

function writePlanFile(file, {
  repo, ref, issue, updatedAt, fingerprint, profile, intake, plan,
}) {
  const target = planRefOf(ref, repo);
  const record = {
    version: PLAN_FILE_VERSION,
    provider: target ? target.provider : 'github',
    repoKey: target ? target.key : null,
    repo: target ? target.slug : repo,
    issue: Number(issue),
    issueFingerprint: fingerprint || null,
    issueUpdatedAt: updatedAt || null,
    profile: profile || 'code',
    intake,
    plan,
  };
  writeFileAtomic0600(file)(`${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/**
 * Read a --plan-out record for this exact issue. The plan is what a person
 * approved; implementing anything else is refused (status 409).
 */
function readPlanFile(file, {
  repo, ref, issue, updatedAt, fingerprint, profile,
}) {
  const target = planRefOf(ref, repo);
  const refuse = (message) => {
    const err = new Error(`--plan-in refused: ${message}`);
    err.status = 409;
    return err;
  };
  // Never echo the parser's message: a SyntaxError quotes the start of the
  // file, which would print a non-plan file's contents. Name the cause only.
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw refuse(`cannot read the plan file (${(err && err.code) || 'read error'})`);
  }
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    throw refuse('the plan file is not valid JSON');
  }
  if (!record || ![1, 2, PLAN_FILE_VERSION].includes(record.version)) {
    throw refuse('unknown plan file version');
  }
  const wanted = target ? target.slug : repo;
  // v1/v2 predate providers: they are GitHub files and compare the slug as
  // they always did. v3 compares the provider and the normalized key.
  const sameRepo = record.version === PLAN_FILE_VERSION
    ? Boolean(target) && record.provider === target.provider && record.repoKey === target.key
    : Boolean(target) && target.provider === 'github' && record.repo === wanted;
  if (!sameRepo || record.issue !== Number(issue)) {
    const where = record.version === PLAN_FILE_VERSION && record.provider && record.provider !== 'github'
      ? `${record.provider}:${record.repo}` : record.repo;
    throw refuse(`the plan is for ${where}#${record.issue}, not ${wanted}#${issue}`);
  }
  if ((record.profile || 'code') !== (profile || 'code')) {
    throw refuse(`the plan used profile ${record.profile}, not ${profile}`);
  }
  if (!record.plan || record.plan.status !== 'accepted') throw refuse('the plan was not accepted');
  const unchanged = record.version === 1
    // Version 1 files carry only updated_at; keep their original check.
    ? Boolean(record.issueUpdatedAt) && record.issueUpdatedAt === updatedAt
    : Boolean(record.issueFingerprint) && record.issueFingerprint === fingerprint;
  if (!unchanged) throw refuse('the issue changed after it was planned; plan it again');
  return { intake: record.intake, plan: record.plan };
}

/**
 * --plan-in skips Stage A, so re-check the entitlement gates the plan was
 * made under: an uninstall, a suspension or a lost write permission between
 * planning and implementing must stop the run (status 403).
 */
function assertStillEntitled({ issue, tenant, entitlement, trigger }) {
  const allowed = entitlementGate({ issue, tenant, entitlement, trigger });
  if (!allowed.ok) {
    const err = new Error(`--plan-in refused: ${allowed.reason}`);
    err.status = 403;
    throw err;
  }
}

/**
 * --plan-in re-runs EVERY deterministic Stage A gate, not only entitlement:
 * a noemi:skip added after planning, an exhausted budget, a body that now
 * fails the scan, or a lost requester must stop implementation. Only the
 * all-gates-passed tier may proceed (status 403 otherwise).
 */
function assertPlanInGates({
  issue, tenant, entitlement, trigger, scan, budget,
}) {
  const gates = classifyIssue({
    issue, tenant, entitlement, trigger, scan, budget,
  });
  if (gates.tier !== 'PENDING_SUFFICIENCY') {
    const err = new Error(`--plan-in refused: ${(gates.reasons || []).join(', ') || gates.tier}`);
    err.status = 403;
    err.intake = gates;
    throw err;
  }
  return gates;
}

/**
 * A plan file is a local file a person may have edited after approving it.
 * It gets the same structural critic (headings, safe paths, carve-outs,
 * profile) and outbound secret scan an accepted plan gets in Stage B′
 * (status 409 otherwise).
 */
function assertPlanInContent(plan, profile) {
  const critique = critiquePlan(plan, { profile });
  if (critique.verdict !== 'pass') {
    const claims = (critique.findings || []).map((f) => f.claim).join(' ');
    const err = new Error(`--plan-in refused: the plan fails the structural critic. ${claims}`.trim());
    err.status = 409;
    throw err;
  }
  const scanned = scanOutboundText(String((plan && plan.plan) || ''));
  if (scanned.status === 'BLOCKED') {
    const err = new Error('--plan-in refused: the plan text fails the secret scan.');
    err.status = 409;
    throw err;
  }
}

/**
 * GitHub follows a renamed or transferred repository's redirect silently.
 * A run asked to work on old-org/name must not act on wherever that now
 * points, so the fetched issue must name the repository we asked for.
 */
function repoMoved(actual, wanted) {
  const err = new Error(`repo-moved: the issue resolved to ${actual || 'an unknown repository'}, not ${wanted}. Refusing.`);
  err.status = 409;
  err.reason = 'repo-moved';
  return err;
}

/** GitHub REST payload form (pre-provider export). */
function assertIssueInRepo(payload, repo) {
  const actual = issueRepoOf(payload);
  if (!actual || actual.toLowerCase() !== String(repo).toLowerCase()) throw repoMoved(actual, repo);
}

/** WorkItem form: the forge-reported repoKey must be the ref we asked for. */
function assertItemInRepo(item, ref) {
  if (!item || !item.repoKey || item.repoKey !== ref.key) {
    const actual = item && item.repoKey ? item.repoKey.replace(/^[^:]+:/, '') : '';
    throw repoMoved(actual, ref.slug);
  }
}

/**
 * The real integration branch, looked up BEFORE any paid model call.
 * Exact single-ref reads (git/ref, not the prefix-matching git/matching-refs)
 * in preference order; the first that exists wins. A hardcoded list here made
 * every repo look like it had `develop`, so a `dev`-only repo paid for a Grok
 * draft and then failed on the missing base.
 */
async function listIntegrationBranches({
  repo, token, ghImpl, provider, ref, cred,
}) {
  const forge = provider || createGithubProvider({ gh: ghImpl });
  return forge.listIntegrationBranches(ref || parseRepoRef(repo), cred || token);
}

async function implementFromPlan({
  args,
  issue,
  plan,
  env = process.env,
  ghImpl = gh,
  token,
  cred,
  provider,
  ref,
  draft = draftChanges,
  open = openImplementationPr,
}) {
  const forge = provider || createGithubProvider({ gh: ghImpl });
  if (!plan || plan.status !== 'accepted') {
    return prepareImplementation({
      issue, plan, branches: [], provider: forge,
    });
  }
  const target = ref || parseRepoRef(args.repo, { env });
  const producer = cred
    || (token ? githubCredential(token, { role: 'producer', source: 'token' }) : null)
    || await forge.resolveCredential({ role: 'producer', ref: target, env });
  const branches = await forge.listIntegrationBranches(target, producer);
  const prepared = prepareImplementation({
    issue, plan, branches, provider: forge,
  });
  if (!args.openPr || prepared.status !== 'ready') return prepared;

  const drafted = await draft({
    issue,
    plan,
    env,
    profile: args.profile,
    repo: target.slug,
    repoRef: target,
    provider: forge,
    base: prepared.base,
    cred: producer,
    token: producer.token,
    // The same apiBase-bound client, so loadBaseFiles reads the base files
    // from the GHES host instead of falling back to api.github.com.
    ghImpl,
  });
  if (drafted.status === 'refused') {
    return {
      ...prepared,
      status: 'refused',
      reason: drafted.reason,
      opened: false,
      writer: 'grok',
      model: drafted.model || null,
    };
  }
  return open({
    repo: target.slug,
    ref: target,
    provider: forge,
    issue,
    plan,
    branches,
    cred: producer,
    token: producer.token,
    files: drafted.files,
    model: drafted.model,
    ghImpl,
    env,
  });
}

function conductorComment({ intake, plan }) {
  if (plan.status === 'accepted') return plan.plan;
  if (plan.status === 'needs-info') {
    return ['Plan red-team did not pass:', ...(plan.findings || []).map((f) => `- ${f.claim}`)].join('\n');
  }
  return (intake.questions || []).map((q) => `- ${q}`).join('\n');
}

function requesterRefused(intake) {
  return Boolean(intake) && (intake.reasons || []).some((reason) => REQUESTER_REFUSALS.has(reason));
}

/**
 * Stages A–D with every outside dependency injectable. main() is the CLI
 * wrapper; tests call this directly. Usage refusals throw status 2.
 */
async function runLoop({
  args,
  env = process.env,
  stderr = process.stderr,
  deps = {},
} = {}) {
  if (!args || !args.repo || !args.issue) throw usageError('Need --repo owner/name and --issue N.');
  let ref;
  let itemId;
  let provider;
  try {
    ({ ref, id: itemId, provider } = assertRepoIssue(args.repo, args.issue, { env }));
    resolveProfile(args.profile);
  } catch (err) {
    throw usageError(err.message);
  }
  if (args.openPr && !args.implement) throw usageError('--open-pr requires --implement.');

  const apiBase = githubApiBase(env);
  // GitHub keeps its historical seams (deps.gh, deps.mintToken) and the
  // apiBase-bound client; any provider can be injected whole as deps.provider.
  const call = deps.gh || ((p, opts = {}) => gh(p, { apiBase, ...opts }));
  if (deps.provider) {
    provider = deps.provider;
  } else if (ref.provider === 'github') {
    provider = createGithubProvider({ gh: call, mint: deps.mintToken });
  }
  const credDeps = { mintToken: deps.mintToken };
  let conductor = null;
  try {
    conductor = await provider.resolveCredential({
      role: 'conductor', ref, env, deps: credDeps,
    });
  } catch (err) {
    throw usageError(err.message);
  }
  if (args.post && !conductor) {
    throw usageError('--post requires CONDUCTOR_GH_TOKEN or CONDUCTOR_APP_ID+CONDUCTOR_APP_PRIVATE_KEY. Refusing AGENT_GH_TOKEN / reviewer tokens (identity split).');
  }
  let producer = null;
  if (args.implement) {
    try {
      producer = await provider.resolveCredential({
        role: 'producer', ref, env, deps: credDeps,
      });
    } catch (err) {
      throw usageError(err.message);
    }
  }
  if (args.openPr) {
    try {
      assertWriterKey(env);
    } catch (err) {
      throw usageError(err.message);
    }
  }
  // Reads use the conductor credential already resolved above, including an
  // installation token minted from the App (Decision [2026-10-03-0002]).
  let reader = conductor;
  if (!reader) {
    try {
      reader = await provider.resolveCredential({
        role: 'reader', ref, env, deps: credDeps,
      });
    } catch (err) {
      throw usageError(err.message);
    }
  }
  if (!reader) {
    throw usageError('Need a conductor token to read the issue (CONDUCTOR_APP_ID + CONDUCTOR_APP_PRIVATE_KEY, or CONDUCTOR_GH_TOKEN). GH_TOKEN and GITHUB_TOKEN also work for a local read.');
  }

  const display = provider.itemDisplay(ref, itemId);
  const tenant = (deps.loadTenant || loadTenant)(args.tenantPath);
  const issue = await provider.getItem(ref, itemId, reader);
  assertItemInRepo(issue, ref);
  const gateInputs = buildGateInputs(args);
  const scan = resolveScanInput(args, issue);
  const entitlement = deps.resolveEntitlement
    ? await deps.resolveEntitlement({
      repo: ref.slug, ref, provider, tenant, env, apiBase,
    })
    : await provider.resolveEntitlement({
      ref, tenant, env, deps: { apiBase },
    });
  const trigger = deps.resolveTrigger
    ? await deps.resolveTrigger({
      repo: ref.slug, ref, provider, login: args.requestedBy, token: reader.token, cred: reader, ghImpl: call,
    })
    : (args.requestedBy ? await provider.requesterPermission(ref, args.requestedBy, reader) : null);
  const fingerprint = issueFingerprint(issue);

  let intake;
  let plan;
  if (args.planIn) {
    assertPlanInGates({
      issue, tenant, entitlement, trigger, scan, budget: gateInputs.budget,
    });
    ({ intake, plan } = readPlanFile(args.planIn, {
      ref, issue: itemId, updatedAt: issue.updatedAt, fingerprint, profile: args.profile,
    }));
    assertPlanInContent(plan, args.profile);
  } else {
    ({ intake, plan } = await (deps.completeThroughStageB || completeThroughStageB)({
      issue,
      tenant,
      entitlement,
      trigger,
      scan,
      budget: gateInputs.budget,
      routing: loadRouting(repoRoot),
      critic: args.liveCritic ? critiquePlanLive : undefined,
      revise: args.liveCritic
        ? (draftPlan, findings, prompt) => revisePlanLive(draftPlan, findings, { prompt })
        : undefined,
      profile: args.profile,
      repoRoot,
    }));
  }
  if (args.planOut && !args.planIn) {
    writePlanFile(args.planOut, {
      ref,
      issue: itemId,
      updatedAt: issue.updatedAt,
      fingerprint,
      profile: args.profile,
      intake,
      plan,
    });
  }

  const risks = [];
  // An outsider (requester refused) leaves no trace: no comment, no label.
  if (args.post && intake.tier !== 'SKIPPED' && !requesterRefused(intake)) {
    const comment = conductorComment({ intake, plan });
    if (comment) {
      const scanned = (deps.scanOutbound || scanOutboundText)(comment);
      if (scanned && scanned.status === 'APPROVED') {
        await provider.postComment(ref, itemId, comment, conductor);
      } else {
        // Types only, never the matched text: the audit log carries no secrets.
        const types = ((scanned && scanned.findings) || []).map((f) => f && f.type).filter(Boolean);
        stderr.write(`${JSON.stringify({
          task: 'Conductor comment outbound scan',
          inputs: [`issue=${display}`, `provider=${provider.id}`],
          actions: ['skip-comment'],
          risks: [`outbound scan ${(scanned && scanned.status) || 'failed'}${types.length ? `: ${types.join(',')}` : ''}`],
          result: 'comment-not-posted',
        })}\n`);
        risks.push('conductor comment withheld: outbound scan blocked it');
      }
    }
  }

  const implementation = args.implement
    ? await (deps.implementFromPlan || implementFromPlan)({
      args,
      issue,
      plan,
      env,
      ghImpl: call,
      provider,
      ref,
      cred: producer,
      token: producer && producer.token,
      draft: deps.draft,
      open: deps.open,
    })
    : null;
  const review = prepareReview({ implementation });
  const label = activeLoopLabel({
    post: args.post,
    intake,
    plan,
    implementation,
    review,
  });
  if (label && conductor) {
    await provider.syncLoopLabel(ref, issue, label, conductor);
  } else if (label) {
    stderr.write('✖ conductor token missing; left the issue label unchanged.\n');
  }

  stderr.write(`${JSON.stringify({
    task: 'Issue-loop Stage A through Stage C',
    inputs: [
      `issue=${display}`,
      `provider=${provider.id}`,
      `post=${args.post}`,
      `implement=${args.implement}`,
      `openPr=${args.openPr}`,
      `liveCritic=${args.liveCritic}`,
      `modelRoute=${loadModelConfig(env).mode}`,
      `scan=${args.scanStatus || (args.scan ? 'local' : 'UNSCANNED')}`,
      `profile=${args.profile || 'code'}`,
      `budget=${args.budgetState || 'unverified'}`,
      // The requester's permission, never their login: audit logs carry no PII (AGENTS.md).
      `requester=${trigger ? (trigger.error ? 'unverified' : trigger.permission) : 'none'}`,
    ],
    actions: [intake.tier, plan.status, implementation && implementation.status, ...(intake.reasons || [])].filter(Boolean),
    risks: [
      ...risks,
      intake.mode === 'heuristic' ? 'sufficiency is heuristic until the Stage A model is wired' : null,
      plan.mode === 'heuristic' && plan.status === 'accepted' ? 'Stage B′ used the structural critic; pass --live-critic for Gemini' : null,
      plan.status === 'needs-info'
        ? (Number.isInteger(plan.maxCycles) && plan.cycles < plan.maxCycles
          ? 'Stage B′ stopped because the plan was not revised'
          : 'Stage B′ hit the cycle limit')
        : null,
      implementation && implementation.status === 'ready' && implementation.opened !== true
        ? 'Stage C envelope ready; pass --open-pr to draft with Grok and open as noemi-agent'
        : null,
    ].filter(Boolean),
    result: label || plan.label || intake.label,
  })}\n`);
  return {
    intake, plan, implementation, review,
  };
}

async function main(argv = process.argv.slice(2), {
  env = process.env, stdout = process.stdout, stderr = process.stderr, deps,
} = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    stdout.write(USAGE);
    return 0;
  }
  const result = await runLoop({
    args, env, stderr, deps,
  });
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

function activeLoopLabel({
  post, intake, plan, implementation, review,
} = {}) {
  if (implementation && implementation.opened) {
    if (review && review.status === 'delegated' && review.label) return review.label;
    return implementation.label || '';
  }
  if (!post || !intake || intake.tier === 'SKIPPED') return '';
  // A run nobody entitled to ask for must not touch the issue at all.
  if (requesterRefused(intake)) return '';
  if (plan && (plan.status === 'accepted' || plan.status === 'needs-info')) return plan.label || '';
  return intake.label || '';
}

/**
 * Pre-provider export. The semantics (add the new label first, then remove
 * the other noemi:* labels; DELETE 404 ignored; both retried on 5xx) live in
 * provider.syncLoopLabel.
 */
async function syncNoemiLabel({
  repo, ref, provider, number, label, current, token, cred, ghImpl,
} = {}) {
  const forge = provider || createGithubProvider({ gh: ghImpl });
  return forge.syncLoopLabel(ref || parseRepoRef(repo), { id: String(number), labels: current }, label, cred || token);
}

function exitCodeForError(err) {
  if (err && err.status === 2) return 2;
  return err && Number.isInteger(err.status) && err.status >= 500 ? 2 : 1;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write(`✖ ${err.message}\n`);
    process.exit(exitCodeForError(err));
  });
}

module.exports = {
  PLAN_FILE_VERSION,
  USAGE,
  activeLoopLabel,
  assertIssueInRepo,
  assertItemInRepo,
  assertPlanInContent,
  assertPlanInGates,
  assertRepoIssue,
  assertStillEntitled,
  buildGateInputs,
  exitCodeForError,
  implementFromPlan,
  issueFingerprint,
  issueReadToken,
  issueRepoOf,
  listIntegrationBranches,
  loadTenant,
  main,
  parseArgs,
  readPlanFile,
  resolveConductorToken,
  resolveScanInput,
  scanText,
  runLoop,
  syncNoemiLabel,
  writePlanFile,
};
