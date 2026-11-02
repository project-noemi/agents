'use strict';
/**
 * Override commands for the advisory AI review: one parser and one
 * authorization rule shared by the reviewer (scripts/review-pr.js) and the
 * calibration seeder (scripts/override-calibration.js), so the two can never
 * disagree about what counts as an override.
 *
 * COMMAND (must start a line of a PR comment)
 *   /override layer=<1-4> rule=<rule-id> sha=<head-sha> reason="<why>" [one-off]
 *
 *   layer   1 premise · 2 framing · 3 code · 4 compliance (gate names accepted)
 *   rule    the finding's rule ID, the calibration dedupe key
 *   sha     the PR head the decision was made on; required for the REVIEW to
 *           honor the override, so a new push makes it stale
 *   reason  required for the review to honor the override. A missing reason
 *           still seeds a calibration draft, flagged incomplete.
 *   one-off the overrider considers this a legitimate exception, not a
 *           reviewer error; recorded on the evidence and the calibration PR.
 *
 * AUTHORIZATION
 *   Only logins in the NOEMI_REVIEW_OVERRIDE_ACTORS Actions variable. Empty
 *   means nobody. The PR author is not special: not listed, not honored.
 *
 * Pure functions only — no network. See docs/AI_REVIEW_OVERRIDE.md.
 */

const crypto = require('node:crypto');

const OVERRIDE_ACTORS_VAR = 'NOEMI_REVIEW_OVERRIDE_ACTORS';
const LAYERS = { 1: 'premise', 2: 'framing', 3: 'code', 4: 'compliance' };
const GATE_LAYER = { premise: 1, framing: 2, code: 3, compliance: 4 };

/** Gates whose overridden failure lets the review continue. Compliance
 *  (layer 4) is last: its override is recorded, never continued. */
const OVERRIDE_CONTINUE_GATES = ['premise', 'framing', 'code'];

const RULE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/;

/** Rules whose overrides always need a security reviewer. */
const SECURITY_RULE = /(secur|secret|credential|token|password|private[-_.]?key|api[-_.]?key|refusal|inject|auth|privacy|pii|exfil|crypt)/i;

const VAGUE_REASONS = /^(ok|okay|fine|n\/?a|na|none|because|false[- ]positive|fp|wrong|not (an )?issue|lgtm|approved|override|overridden|trust me|see above|as discussed|per discussion|ignore|whatever|it'?s fine|fixed|done|yes|no)[.!]*$/i;

const LABELS = {
  calibration: 'ai-review-calibration',
  security: 'security-review-required',
  oneOff: 'one-off-override',
  incomplete: 'incomplete-override-reason',
};

function parseOverrideActors(raw) {
  return new Set(String(raw || '')
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean));
}

const COMMAND_LINE = /^\/override(?=\s|$)(.*)$/;

/** Parse the argument string of one `/override` line. */
function parseArgsString(rest) {
  const out = { fields: {}, oneOff: false, errors: [] };
  let s = rest;
  for (;;) {
    s = s.replace(/^\s+/, '');
    if (!s) break;
    if (/^one-off(?=\s|$)/i.test(s)) { out.oneOff = true; s = s.slice(7); continue; }
    const kv = s.match(/^(layer|rule|sha|reason)=/i);
    if (!kv) { out.errors.push(`unexpected token '${s.split(/\s/)[0].slice(0, 40)}'`); break; }
    const key = kv[1].toLowerCase();
    s = s.slice(kv[0].length);
    if (key in out.fields) out.errors.push(`duplicate ${key}=`);
    let value;
    const q = s.match(/^"((?:[^"\\]|\\.)*)"/) || s.match(/^'((?:[^'\\]|\\.)*)'/);
    if (q) {
      value = q[1].replace(/\\(["'\\])/g, '$1');
      s = s.slice(q[0].length);
    } else if (key === 'reason') {
      // Unquoted (or unclosed quote): the rest of the line is the reason,
      // except a trailing one-off flag. Nothing typed is dropped.
      let r = s;
      const flag = r.match(/\s+one-off\s*$/i);
      if (flag) { out.oneOff = true; r = r.slice(0, flag.index); }
      value = r.replace(/^["']/, '').trim();
      s = '';
    } else {
      const m = s.match(/^\S*/);
      value = m[0];
      s = s.slice(value.length);
    }
    out.fields[key] = value;
  }
  return out;
}

/**
 * Extract override commands from one comment body. Only lines that START with
 * `/override` count. Each result is either a command or { error, raw }.
 *   { layer, gate, rule, sha|null, reason|null, oneOff, raw }
 */
function parseOverrideCommands(body) {
  const out = [];
  for (const line of String(body || '').split(/\r?\n/)) {
    const raw = line.trim();
    const m = raw.match(COMMAND_LINE);
    if (!m) continue;
    const { fields, oneOff, errors } = parseArgsString(m[1]);
    const lv = String(fields.layer || '').toLowerCase();
    const layer = /^[1-4]$/.test(lv) ? Number(lv) : (GATE_LAYER[lv] || null);
    if (!fields.layer) errors.push('layer= is required (1-4)');
    else if (!layer) errors.push(`layer must be 1-4, got '${fields.layer.slice(0, 20)}'`);
    if (!fields.rule) errors.push('rule= is required');
    else if (!RULE_ID.test(fields.rule)) errors.push('rule= must be letters, digits, and . _ : / - (max 80)');
    if (fields.sha !== undefined && !/^[0-9a-f]{7,40}$/i.test(fields.sha)) errors.push('sha= must be 7-40 hex characters');
    if (errors.length) {
      out.push({ error: `malformed — ${errors.join('; ')}. Expected \`/override layer=<1-4> rule=<rule-id> sha=<head-sha> reason="..." [one-off]\``, raw });
      continue;
    }
    const reason = fields.reason === undefined ? null : (fields.reason.trim() || null);
    out.push({
      layer, gate: LAYERS[layer], rule: fields.rule, sha: fields.sha ? fields.sha.toLowerCase() : null,
      reason, oneOff, raw,
    });
  }
  return out;
}

/** Is this actor allowed to override? */
function authorize(actor, allowlist, prAuthor) {
  const allowed = allowlist instanceof Set ? allowlist : parseOverrideActors(allowlist);
  const a = String(actor || '').toLowerCase();
  if (a && allowed.has(a)) return { ok: true, why: '' };
  if (allowed.size === 0) return { ok: false, why: `${OVERRIDE_ACTORS_VAR} is not set, so no override is honored` };
  if (a && a === String(prAuthor || '').toLowerCase()) {
    return { ok: false, why: `@${actor} is the PR author and is not in ${OVERRIDE_ACTORS_VAR}` };
  }
  return { ok: false, why: `@${actor || '(unknown)'} is not in ${OVERRIDE_ACTORS_VAR}` };
}

/** 'missing' | 'vague' | 'ok'. Never rewrites the reason. */
function reasonQuality(reason) {
  if (reason === null || reason === undefined || !String(reason).trim()) return 'missing';
  const r = String(reason).trim();
  if (VAGUE_REASONS.test(r) || r.length < 15 || r.split(/\s+/).length < 3) return 'vague';
  return 'ok';
}

function isSecurityRule(rule, layer) {
  return Number(layer) === 4 || SECURITY_RULE.test(String(rule || ''));
}

/** Branch/file-safe slug; rule IDs compare case-insensitively. */
function ruleSlug(rule) {
  return String(rule).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'rule';
}

/**
 * Reviewer side: which commands does this review honor?
 * Returns { accepted: { [gate]: [override...] }, notApplied: [...], present }.
 * Ignored, with the reason shown: malformed, not allowlisted (PR author
 * included), edited after posting, no reason, no sha, stale sha.
 */
function evaluateOverrides(comments, { allowlist, headSha, prAuthor }) {
  const allowed = allowlist instanceof Set ? allowlist : parseOverrideActors(allowlist);
  const head = String(headSha || '').toLowerCase();
  const accepted = {};
  const notApplied = [];
  let present = false;
  const sorted = [...(comments || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (const c of sorted) {
    const cmds = parseOverrideCommands(c.body);
    if (!cmds.length) continue;
    present = true;
    const actor = c.user && c.user.login ? c.user.login : '(unknown)';
    const base = { actor, created_at: c.created_at, url: c.html_url };
    for (const cmd of cmds) {
      const rec = {
        ...base, gate: cmd.gate || null, layer: cmd.layer || null, rule: cmd.rule || null,
        sha: cmd.sha || null, reason: cmd.reason || null, one_off: Boolean(cmd.oneOff),
      };
      if (cmd.error) { notApplied.push({ ...rec, why: cmd.error }); continue; }
      const auth = authorize(actor, allowed, prAuthor);
      if (!auth.ok) { notApplied.push({ ...rec, why: auth.why }); continue; }
      if (c.updated_at && c.created_at && c.updated_at !== c.created_at) {
        notApplied.push({ ...rec, why: 'comment was edited after posting — post a new comment instead' });
        continue;
      }
      if (!cmd.reason) {
        notApplied.push({ ...rec, why: 'incomplete — no reason provided; the review applies an override only with a reason' });
        continue;
      }
      if (!cmd.sha) {
        notApplied.push({ ...rec, why: 'no sha= given; an override applies only to the head SHA it names' });
        continue;
      }
      if (!head || !head.startsWith(cmd.sha)) {
        notApplied.push({ ...rec, why: `stale — given for \`${cmd.sha.slice(0, 12)}\`, current head is \`${head.slice(0, 12)}\`` });
        continue;
      }
      (accepted[cmd.gate] = accepted[cmd.gate] || []).push(rec);
    }
  }
  return { accepted, notApplied, present };
}

// ---------------------------------------------------------------------------
// Calibration evidence
// ---------------------------------------------------------------------------

const EVIDENCE_DIR = 'docs/reviews/overrides';
const BRANCH_PREFIX = 'calibration/override/';

function evidencePath(rule) { return `${EVIDENCE_DIR}/${ruleSlug(rule)}.md`; }

/**
 * Snapshot one accepted command. Taken from the comment-created event
 * payload, so a later edit or deletion of the comment cannot change it; the
 * body hash lets anyone verify the copy against what was posted.
 */
function buildEvidence({ comment, cmd, repo, pr, snapshotAt }) {
  const body = String(comment.body || '');
  return {
    rule: cmd.rule,
    layer: cmd.layer,
    gate: cmd.gate,
    one_off: Boolean(cmd.oneOff),
    reason: cmd.reason,
    reason_quality: reasonQuality(cmd.reason),
    security_review_required: isSecurityRule(cmd.rule, cmd.layer),
    sha_given: cmd.sha || null,
    author: comment.user && comment.user.login ? comment.user.login : '(unknown)',
    comment_id: comment.id,
    comment_url: comment.html_url,
    comment_created_at: comment.created_at,
    comment_body: body,
    comment_body_sha256: crypto.createHash('sha256').update(body, 'utf8').digest('hex'),
    source_repo: repo,
    source_pr: pr.number,
    source_pr_url: pr.html_url,
    source_pr_title: pr.title || '',
    source_head_sha: (pr.head && pr.head.sha) || null,
    snapshot_at: snapshotAt,
  };
}

function evidenceKey(e) { return `${e.source_repo}#${e.comment_id}#${String(e.rule).toLowerCase()}#${e.layer}`; }

function fenceFor(text) {
  const runs = String(text).match(/`+/g) || [];
  const longest = runs.reduce((n, r) => Math.max(n, r.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

function renderEvidenceEntry(e) {
  const fence = fenceFor(e.comment_body);
  const json = JSON.stringify(e, null, 2);
  const jfence = fenceFor(json);
  return [
    `<!-- override-evidence key=${JSON.stringify(evidenceKey(e))} -->`,
    `### ${e.source_repo}#${e.source_pr} — @${e.author} — ${e.comment_created_at}`,
    '',
    `- Layer ${e.layer} (${e.gate}) · rule \`${e.rule}\`${e.one_off ? ' · **one-off**' : ''}`,
    `- Source PR: ${e.source_pr_url} · comment: ${e.comment_url}`,
    `- Reason: ${reasonLine(e)}`,
    `- Snapshot taken ${e.snapshot_at} from the comment-created event; body sha256 \`${e.comment_body_sha256}\``,
    '',
    'Comment text at acceptance (verbatim):',
    '',
    `${fence}text`,
    e.comment_body,
    fence,
    '',
    `${jfence}json`,
    json,
    jfence,
    '',
  ].join('\n');
}

function reasonLine(e) {
  if (e.reason_quality === 'missing') return '**incomplete — no reason provided**';
  const verbatim = `"${String(e.reason).replace(/\r?\n/g, ' ')}"`;
  return e.reason_quality === 'vague'
    ? `${verbatim} — ⚠️ this reason may be too vague to calibrate from; please ask @${e.author} for more detail (what the reviewer got wrong, and why).`
    : verbatim;
}

function evidenceFileHeader(rule) {
  return [
    `# Override evidence — rule \`${rule}\``,
    '',
    'Seeded automatically from `/override` comments (docs/AI_REVIEW_OVERRIDE.md).',
    'Each entry is a snapshot taken when the override was accepted; editing or',
    'deleting the original comment does not change it. This file records',
    'evidence only. It changes no reviewer behavior. A human decides any tuning.',
    '',
  ].join('\n');
}

/**
 * Parse entries back out of an evidence file: top-level ```json blocks only.
 * Fence-aware, so a json block quoted INSIDE a snapshotted comment (which sits
 * in a longer text fence) can never be read as evidence.
 */
function parseEvidenceFile(text) {
  const out = [];
  let fence = null;
  let capture = null;
  for (const line of String(text || '').split('\n')) {
    if (fence) {
      if (line === fence) {
        if (capture) { try { out.push(JSON.parse(capture.join('\n'))); } catch { /* not evidence */ } }
        fence = null; capture = null;
      } else if (capture) capture.push(line);
      continue;
    }
    const open = line.match(/^(`{3,})(\w*)$/);
    if (open) { fence = open[1]; capture = open[2] === 'json' ? [] : null; }
  }
  return out;
}

/** Append evidence; returns { text, added } and never duplicates an entry. */
function appendEvidence(existing, e) {
  const entries = parseEvidenceFile(existing);
  if (entries.some((x) => evidenceKey(x) === evidenceKey(e))) return { text: existing, added: false };
  const head = existing && existing.trim() ? existing.replace(/\s*$/, '\n\n') : `${evidenceFileHeader(e.rule)}\n`;
  return { text: `${head}${renderEvidenceEntry(e)}`, added: true };
}

function labelsFor(entries) {
  const set = [LABELS.calibration];
  if (entries.some((e) => e.security_review_required)) set.push(LABELS.security);
  if (entries.some((e) => e.one_off)) set.push(LABELS.oneOff);
  if (entries.some((e) => e.reason_quality === 'missing')) set.push(LABELS.incomplete);
  return set;
}

function cell(t) { return String(t === null || t === undefined ? '' : t).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '); }

function calibrationTitle(entries) {
  const e = entries[0];
  const incomplete = entries.some((x) => x.reason_quality === 'missing') ? '[incomplete] ' : '';
  return `${incomplete}docs(reviews): calibration draft — override of \`${e.rule}\` (layer ${e.layer} ${e.gate})`;
}

function calibrationBody(entries) {
  const e0 = entries[0];
  const out = [
    `Draft calibration PR seeded from override comments for rule \`${e0.rule}\` (layer ${e0.layer}, ${e0.gate}).`,
    '',
    'This PR records **evidence only**: the overridden finding is still shown as **OVERRIDDEN** (never PASS) in the review, and nothing here changes reviewer behavior. A human reviews the evidence, writes any tuning by hand, and merges, or closes the PR.',
    '',
  ];
  if (entries.some((e) => e.security_review_required)) {
    out.push(`> **🔒 ${LABELS.security}.** This is a layer-4 (compliance) override or a security/secret/refusal-class rule. The bot does not propose weakening this rule. A security reviewer decides whether anything changes.`, '');
  }
  const missing = entries.filter((e) => e.reason_quality === 'missing').length;
  if (missing) out.push(`> **incomplete — no reason provided** for ${missing} override(s). No reason has been supplied or inferred. Ask the overrider.`, '');
  const vague = entries.filter((e) => e.reason_quality === 'vague').length;
  if (vague) out.push(`> ⚠️ ${vague} reason(s) may be too vague to calibrate from. They are quoted verbatim below; please ask for more detail.`, '');
  const oneOff = entries.filter((e) => e.one_off).length;
  if (oneOff) out.push(`> **one-off:** ${oneOff} of ${entries.length} override(s) were flagged \`one-off\` by the overrider. If all of them are legitimate exceptions rather than reviewer errors, close this PR as a one-off.`, '');
  out.push(`### Evidence (${entries.length})`, '', '| # | Source PR | Layer | Overrider | When (UTC) | One-off | Reason (verbatim) | Comment |', '|---|---|---|---|---|---|---|---|');
  entries.forEach((e, i) => {
    const reason = e.reason_quality === 'missing' ? '**incomplete — no reason provided**'
      : `${cell(e.reason)}${e.reason_quality === 'vague' ? ' ⚠️ vague, please ask for more detail' : ''}`;
    out.push(`| ${i + 1} | ${e.source_repo}#${e.source_pr} | ${e.layer} (${e.gate}) | @${e.author} | ${e.comment_created_at} | ${e.one_off ? 'yes' : 'no'} | ${reason} | [link](${e.comment_url}) |`);
  });
  out.push('', `Full snapshots (comment text, sha256, head SHA at acceptance): \`${evidencePath(e0.rule)}\`.`, '',
    'Seeded by `.github/workflows/override-calibration.yml`. Always a draft. Never merged automatically.');
  return out.join('\n');
}

function sourceBacklink({ e, calPr, created }) {
  const flags = [
    e.security_review_required ? LABELS.security : null,
    e.one_off ? 'one-off' : null,
    e.reason_quality === 'missing' ? 'incomplete — no reason provided' : null,
    e.reason_quality === 'vague' ? 'reason may be vague' : null,
  ].filter(Boolean);
  return [
    `Override recorded: layer ${e.layer} (${e.gate}), rule \`${e.rule}\`, by @${e.author} (${e.comment_url}).`,
    '',
    `Calibration draft: ${calPr ? `#${calPr.number} (${calPr.html_url})` : '(pending)'}, ${created ? 'opened' : 'evidence appended'}.${flags.length ? ` Flags: ${flags.join(', ')}.` : ''}`,
    '',
    'The overridden finding stays OVERRIDDEN in the review. It is never shown as a pass.',
  ].join('\n');
}

function ignoredNotice(items) {
  return [
    'Override command(s) in this comment were **not accepted**. No calibration PR was opened or changed:',
    '',
    ...items.map((x) => `- ${x.why}${x.raw ? ` (\`${x.raw.replace(/`/g, "'").slice(0, 120)}\`)` : ''}`),
  ].join('\n');
}

module.exports = {
  OVERRIDE_ACTORS_VAR, LAYERS, GATE_LAYER, OVERRIDE_CONTINUE_GATES, LABELS, EVIDENCE_DIR, BRANCH_PREFIX,
  parseOverrideActors, parseOverrideCommands, authorize, reasonQuality, isSecurityRule, ruleSlug,
  evaluateOverrides, buildEvidence, evidenceKey, evidencePath, renderEvidenceEntry, parseEvidenceFile,
  appendEvidence, labelsFor, calibrationTitle, calibrationBody, sourceBacklink, ignoredNotice,
};
