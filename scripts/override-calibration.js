#!/usr/bin/env node
/**
 * Override → calibration seeding.
 *
 * Triggered by .github/workflows/override-calibration.yml on a NEW comment on
 * a pull request. For each `/override` command in it (syntax and authorization
 * rules: scripts/review-override.js):
 *
 *   - not authorized, or malformed → flagged on the source PR; nothing seeded
 *   - authorized → evidence SNAPSHOT taken from the event payload (comment
 *     text, author, timestamp, rule, layer, source PR, comment URL, body hash,
 *     head SHA), then appended to the ONE open DRAFT calibration PR for that
 *     rule ID, or a new draft is opened when none is open. Source PR and
 *     calibration PR are linked both ways.
 *
 * It never invents a reason, never proposes a rule change (it writes evidence
 * under docs/reviews/overrides/ only), never marks a draft ready, and never
 * merges. A human writes any tuning and merges.
 *
 * MODES
 *   screen  no token. Parse + authorize the event comment; print a JSON summary
 *           and set GITHUB_OUTPUT accepted=<n> ignored=<n>.
 *   flag    GH_TOKEN = workflow GITHUB_TOKEN (pull-requests: write). Posts the
 *           "not accepted" notice on the source PR.
 *   seed    GH_TOKEN = noemi-agent (via Infisical). Writes evidence and the
 *           calibration draft. Re-authorizes independently of `screen`.
 *
 *   node scripts/override-calibration.js <mode> --override-actors "a,b"
 *   The allowlist is an ARGUMENT expanded from vars.NOEMI_REVIEW_OVERRIDE_ACTORS,
 *   never read from env, so the Infisical vault cannot supply it.
 */

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const ov = require('./review-override.js');
const { verifyTokenLogin } = require('./calibration-watch.js');

// ---------------------------------------------------------------------------
// Pure: classify the commands in one comment event
// ---------------------------------------------------------------------------

function screenEvent(event, allowlist) {
  const result = { relevant: false, accepted: [], ignored: [] };
  if (!event || event.action !== 'created') return result;
  if (!event.issue || !event.issue.pull_request) return result;
  const comment = event.comment || {};
  const cmds = ov.parseOverrideCommands(comment.body);
  if (!cmds.length) return result;
  result.relevant = true;
  const actor = comment.user && comment.user.login;
  const prAuthor = event.issue.user && event.issue.user.login;
  for (const cmd of cmds) {
    if (cmd.error) { result.ignored.push({ why: cmd.error, raw: cmd.raw }); continue; }
    const auth = ov.authorize(actor, allowlist, prAuthor);
    if (!auth.ok) { result.ignored.push({ why: `${auth.why} — command ignored`, raw: cmd.raw }); continue; }
    result.accepted.push(cmd);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Seeding against an injected GitHub API (tests use an in-memory fake)
// ---------------------------------------------------------------------------

/**
 * Find the open calibration PR for a rule, or decide on a fresh branch.
 * Dedupe key: the rule slug. Branch `calibration/override/<slug>` is the
 * primary name; if a closed/merged PR already used it, a suffixed branch is
 * used so a later override opens a NEW draft.
 */
async function locateCalibration(api, slug, commentId) {
  const prefix = `${ov.BRANCH_PREFIX}${slug}`;
  const open = (await api.listOpenPulls()).filter((p) => p.head && (p.head.ref === prefix || p.head.ref.startsWith(`${prefix}--`)));
  if (open.length) return { pr: open[0], branch: open[0].head.ref, create: false };
  const used = await api.pullsForHead(prefix);
  const branch = used.length ? `${prefix}--${commentId}` : prefix;
  return { pr: null, branch, create: true };
}

async function seedOne(api, { event, cmd, now }) {
  const repo = event.repository.full_name;
  const base = event.repository.default_branch;
  const pr = await api.getPull(event.issue.number);
  const e = ov.buildEvidence({ comment: event.comment, cmd, repo, pr, snapshotAt: now });
  const slug = ov.ruleSlug(cmd.rule);
  const file = ov.evidencePath(cmd.rule);

  let loc = await locateCalibration(api, slug, event.comment.id);
  if (loc.create) {
    const baseSha = await api.refSha(base);
    const made = await api.createRef(loc.branch, baseSha);
    if (!made) {
      // Lost a race to a concurrent run: the branch exists now. Use it.
      loc = { pr: null, branch: loc.branch, create: false };
    }
  }

  // Append evidence with optimistic concurrency (retry on a stale file sha).
  let added = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const cur = await api.getFile(file, loc.branch);
    const { text, added: isNew } = ov.appendEvidence(cur ? cur.text : '', e);
    if (!isNew) break;
    const ok = await api.putFile(file, loc.branch, text, cur ? cur.sha : null,
      `docs(reviews): override evidence for ${cmd.rule} from ${repo}#${pr.number}`);
    if (ok) { added = true; break; }
  }

  const cur = await api.getFile(file, loc.branch);
  const entries = ov.parseEvidenceFile(cur ? cur.text : '').filter((x) => ov.ruleSlug(x.rule) === slug);
  const labels = ov.labelsFor(entries.length ? entries : [e]);
  let calPr = loc.pr;
  let created = false;
  if (!calPr) {
    calPr = (await api.listOpenPulls()).find((p) => p.head && p.head.ref === loc.branch) || null;
  }
  if (!calPr) {
    calPr = await api.createPull({
      head: loc.branch, base, draft: true,
      title: ov.calibrationTitle(entries), body: ov.calibrationBody(entries),
    });
    created = true;
  } else {
    await api.updatePull(calPr.number, { title: ov.calibrationTitle(entries), body: ov.calibrationBody(entries) });
  }
  for (const l of labels) await api.ensureLabel(l);
  await api.addLabels(calPr.number, labels);

  if (added) {
    if (!created) {
      await api.comment(calPr.number, `New override evidence from ${repo}#${pr.number} (${pr.html_url}) by @${e.author}: ${e.comment_url}`);
    }
    await api.comment(pr.number, ov.sourceBacklink({ e, calPr, created }));
  }
  return { evidence: e, calPr, created, added, labels, branch: loc.branch };
}

async function seedEvent(api, event, allowlist, now = new Date().toISOString()) {
  const s = screenEvent(event, allowlist);
  const results = [];
  for (const cmd of s.accepted) results.push(await seedOne(api, { event, cmd, now }));
  return { screen: s, results };
}

// ---------------------------------------------------------------------------
// gh CLI-backed API (production)
// ---------------------------------------------------------------------------

function ghRaw(args, input) {
  return execFileSync('gh', args, { encoding: 'utf8', input, timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
}

function ghJson(method, path, body) {
  const args = ['api', '--method', method, path, '-H', 'Accept: application/vnd.github+json'];
  if (body !== undefined) args.push('--input', '-');
  const out = ghRaw(args, body !== undefined ? JSON.stringify(body) : undefined);
  return out.trim() ? JSON.parse(out) : null;
}

function isStatus(err, codes) {
  const t = `${err && err.stderr ? err.stderr : ''}\n${err && err.message ? err.message : ''}`;
  return codes.some((c) => new RegExp(`HTTP ${c}\\b`).test(t));
}

function ghApi(repo) {
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  return {
    async getPull(n) { return ghJson('GET', `repos/${repo}/pulls/${n}`); },
    async listOpenPulls() {
      const all = [];
      for (let page = 1; page <= 20; page += 1) {
        const batch = ghJson('GET', `repos/${repo}/pulls?state=open&per_page=100&page=${page}`);
        all.push(...batch);
        if (batch.length < 100) break;
      }
      return all;
    },
    async pullsForHead(branch) {
      return ghJson('GET', `repos/${repo}/pulls?state=all&head=${encodeURIComponent(`${repo.split('/')[0]}:${branch}`)}&per_page=100`);
    },
    async refSha(branch) { return ghJson('GET', `repos/${repo}/git/ref/heads/${enc(branch)}`).object.sha; },
    async createRef(branch, sha) {
      try { ghJson('POST', `repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha }); return true; } catch (err) {
        if (isStatus(err, [422])) return false;
        throw err;
      }
    },
    async getFile(path, ref) {
      try {
        const f = ghJson('GET', `repos/${repo}/contents/${enc(path)}?ref=${encodeURIComponent(ref)}`);
        return { sha: f.sha, text: Buffer.from(f.content, 'base64').toString('utf8') };
      } catch (err) {
        if (isStatus(err, [404])) return null;
        throw err;
      }
    },
    async putFile(path, branch, text, sha, message) {
      try {
        ghJson('PUT', `repos/${repo}/contents/${enc(path)}`, {
          message, branch, content: Buffer.from(text, 'utf8').toString('base64'), ...(sha ? { sha } : {}),
        });
        return true;
      } catch (err) {
        if (isStatus(err, [409, 422])) return false;
        throw err;
      }
    },
    async createPull(p) { return ghJson('POST', `repos/${repo}/pulls`, p); },
    async updatePull(n, p) { return ghJson('PATCH', `repos/${repo}/pulls/${n}`, p); },
    async ensureLabel(name) {
      try { ghJson('POST', `repos/${repo}/labels`, { name, color: name === ov.LABELS.security ? 'b60205' : 'c5def5' }); } catch (err) {
        if (!isStatus(err, [422])) throw err;
      }
    },
    async addLabels(n, labels) { ghJson('POST', `repos/${repo}/issues/${n}/labels`, { labels }); },
    async comment(n, body) { ghJson('POST', `repos/${repo}/issues/${n}/comments`, { body }); },
  };
}

function parseCli(argv) {
  const a = { mode: argv[0], actors: '' };
  for (let i = 1; i < argv.length; i += 1) if (argv[i] === '--override-actors') a.actors = argv[++i] || '';
  return a;
}

async function main() {
  const args = parseCli(process.argv.slice(2));
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const s = screenEvent(event, args.actors);
  if (args.mode === 'screen') {
    process.stdout.write(`${JSON.stringify({ relevant: s.relevant, accepted: s.accepted.length, ignored: s.ignored.length })}\n`);
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `accepted=${s.accepted.length}\nignored=${s.ignored.length}\n`);
    }
    return;
  }
  const repo = event.repository.full_name;
  if (args.mode === 'flag') {
    if (s.ignored.length) await ghApi(repo).comment(event.issue.number, ov.ignoredNotice(s.ignored));
    return;
  }
  if (args.mode === 'seed') {
    // Writes happen only as the machine user, never as whoever owns a token
    // that happened to be injected.
    const login = ghRaw(['api', 'user', '--jq', '.login']).trim();
    const verdict = verifyTokenLogin(login, process.env.AGENT_GH_EXPECTED_LOGIN || 'noemi-agent');
    if (!verdict.allowed) { process.stderr.write(`✖ ${verdict.reason}\n`); process.exit(2); }
    const out = await seedEvent(ghApi(repo), event, args.actors);
    process.stderr.write(`${JSON.stringify({
      task: 'Override calibration seeding',
      inputs: [`pr=${repo}#${event.issue.number}`, `comment=${event.comment.id}`],
      actions: out.results.map((r) => `${r.created ? 'opened' : 'appended to'} #${r.calPr.number} for ${r.evidence.rule}${r.added ? '' : ' (already recorded)'}`),
      risks: out.results.filter((r) => r.evidence.security_review_required).map((r) => `${r.evidence.rule}: security review required`),
      result: `${out.results.length} override(s) recorded`,
    })}\n`);
    return;
  }
  process.stderr.write('Usage: override-calibration.js <screen|flag|seed> --override-actors "a,b"\n');
  process.exit(2);
}

module.exports = { screenEvent, locateCalibration, seedOne, seedEvent, parseCli };

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`✖ ${err.stack || err.message}\n`);
    process.exit(2);
  });
}
