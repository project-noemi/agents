'use strict';

/**
 * Stage C Grok writer. Drafts file contents for an accepted plan.
 * Does not open a PR — that is dispatch.openImplementationPr with AGENT_GH_TOKEN.
 */

const { withRetry } = require('../scripts/resilience_helpers.js');
const { scanIssueBody } = require('./scan.js');
const { httpError, modelRetryOptions } = require('./http.js');

const XAI_API = 'https://api.x.ai/v1';
const NEWPUSH_AI_GW_V1 = 'https://ai-gw.newpush.com/v1';
const DEFAULT_GW_GROK_MODEL = 'xai/grok-4.6';
const MAX_FILES = 20;
const MAX_FILE_CHARS = 200000;

const path = require('path');

const CARVE_OUT = [
  '.github/CODEOWNERS',
  'docs/MACHINE_IDENTITY.md',
  'docs/AI_REVIEW_GOVERNANCE.md',
];

function normalizeRepoPath(filePath) {
  return path.posix.normalize(String(filePath || '').replace(/\\/g, '/')).replace(/^\.\/+/, '');
}

/** Any Actions workflow is a CI RCE surface. Listing two YAML files is not enough. */
function isCarvedOut(filePath) {
  const normalized = normalizeRepoPath(filePath);
  if (CARVE_OUT.includes(normalized)) return true;
  return normalized === '.github/workflows' || normalized.startsWith('.github/workflows/');
}

function normalizeApiBase(url) {
  const raw = String(url || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  return /\/v1$/i.test(raw) ? raw : `${raw}/v1`;
}

function resolveWriterAuth(env = process.env) {
  if (env && env.XAI_API_KEY) {
    return {
      apiKey: env.XAI_API_KEY,
      apiBase: normalizeApiBase(env.XAI_API_BASE) || XAI_API,
      source: 'XAI_API_KEY',
      pinDefault: '',
    };
  }
  const gwKey = env && (env.AI_GW_API_TOKEN || env.AI_GW_API_KEY);
  if (gwKey) {
    const apiBase = normalizeApiBase(
      env.AI_GW_BASE_URL || env.AI_GW_API_BASE || NEWPUSH_AI_GW_V1,
    );
    return {
      apiKey: gwKey,
      apiBase,
      source: env.AI_GW_API_TOKEN ? 'AI_GW_API_TOKEN' : 'AI_GW_API_KEY',
      pinDefault: DEFAULT_GW_GROK_MODEL,
    };
  }
  const err = new Error(
    'Stage C --open-pr requires XAI_API_KEY, or AI_GW_API_TOKEN / AI_GW_API_KEY (Fetch-on-Demand).',
  );
  err.status = 400;
  throw err;
}

function assertWriterKey(env = process.env) {
  return resolveWriterAuth(env).apiKey;
}

function stripProviderPrefix(id) {
  return String(id || '').replace(/^models\//, '').replace(/^(openai|xai|litellm)\//i, '');
}

function classifyGrok(id) {
  const apiId = String(id || '').replace(/^models\//, '');
  const name = stripProviderPrefix(apiId);
  if (!/^grok-/.test(name)) return null;
  if (/(?:vision|image|tts|audio|voice|realtime|video)/.test(name)) return null;
  const versionMatch = name.match(/grok-(\d+(?:\.\d+)?)/);
  const generation = versionMatch ? parseFloat(versionMatch[1]) : 0;
  const preview = /preview|exp(erimental)?|-rc|beta/.test(name);
  const slim = /mini|fast|lite|nano/.test(name);
  return { id: apiId, name, generation, preview, slim };
}

function selectGrokModel(ids, { pin } = {}) {
  const classified = (Array.isArray(ids) ? ids : []).map(classifyGrok).filter(Boolean);
  if (pin && pin !== 'auto') {
    const wantRaw = String(pin).replace(/^models\//, '');
    const wantName = stripProviderPrefix(wantRaw);
    const hit = classified.find(
      (item) => item.id === wantRaw || stripProviderPrefix(item.id) === wantName,
    );
    if (!hit) {
      throw httpError(`Pinned XAI_CODE_MODEL '${wantRaw}' is not in the catalogue`, 400);
    }
    return hit;
  }
  const rank = (a, b) => {
    if (a.generation !== b.generation) return b.generation - a.generation;
    if (a.slim !== b.slim) return a.slim ? 1 : -1;
    return (b.preview ? 1 : 0) - (a.preview ? 1 : 0);
  };
  const previews = classified.filter((item) => item.preview && !item.slim).sort(rank);
  if (previews[0]) return previews[0];
  const stable = classified.filter((item) => !item.preview && !item.slim).sort(rank);
  if (stable[0]) return stable[0];
  const any = classified.sort(rank);
  if (any[0]) return any[0];
  throw httpError('No Grok model available in the xAI catalogue', 503);
}

function connectionMatches(text) {
  return String(text || '').match(/\b(?:postgres|mysql|mongodb):\/\/\S+/gi) || [];
}

function credentialedConnection(match) {
  return String(match).includes('@') || /[?&](?:password|pwd|pass|token|secret)=/i.test(match);
}

// The scanner stays strict. A host-only URL that is already on the base
// branch may be kept verbatim. A new URL, userinfo, or a secret query
// parameter still blocks (advisory premise on #591).
function scanDraftContent(content, prior) {
  const known = new Set(connectionMatches(prior).filter((match) => !credentialedConnection(match)));
  // Replace a whole URL token only. split() would also rewrite a known URL
  // that is the prefix of a longer credentialed URL (advisory code on #591).
  const text = String(content).replace(/\b(?:postgres|mysql|mongodb):\/\/\S+/gi, (match) => (
    known.has(match) ? 'local-service' : match
  ));
  return scanIssueBody(text);
}

function sourceAllowedDespiteScan(content) {
  const scan = scanIssueBody(content);
  if (scan.status !== 'BLOCKED') return true;
  if (scan.findings.some((finding) => finding.type !== 'connection_string')) return false;
  const matches = connectionMatches(content);
  return matches.length > 0 && matches.every((match) => !credentialedConnection(match));
}

function validateFiles(files, plan, profile, sources) {
  const { pathAllowedByProfile } = require('./profile.js');
  const priorByPath = new Map(
    (Array.isArray(sources) ? sources : [])
      .filter((source) => source && !source.missing && typeof source.content === 'string')
      .map((source) => [source.path, source.content]),
  );
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, reason: 'writer-empty' };
  }
  if (files.length > MAX_FILES) {
    return { ok: false, reason: 'writer-too-many-files' };
  }
  const allowed = new Set(Array.isArray(plan && plan.files) ? plan.files : []);
  for (const file of files) {
    const filePath = file && file.path;
    if (typeof filePath !== 'string' || !filePath || filePath.includes('..') || filePath.startsWith('/')) {
      return { ok: false, reason: 'writer-bad-path' };
    }
    if (isCarvedOut(filePath)) {
      return { ok: false, reason: 'writer-carve-out' };
    }
    if (!pathAllowedByProfile(filePath, profile)) {
      return { ok: false, reason: 'writer-profile-path' };
    }
    if (!allowed.has(filePath)) {
      return { ok: false, reason: 'writer-path-not-in-plan' };
    }
    if (typeof file.content !== 'string' || file.content.length === 0) {
      return { ok: false, reason: 'writer-empty-file' };
    }
    if (file.content.length > MAX_FILE_CHARS) {
      return { ok: false, reason: 'writer-file-too-large' };
    }
    const scan = scanDraftContent(file.content, priorByPath.get(filePath) || '');
    if (scan.status === 'BLOCKED') {
      return { ok: false, reason: 'writer-scan-blocked' };
    }
  }
  return { ok: true };
}

function parseJsonObject(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        // The slice is still not JSON. Fall through to the same error.
      }
    }
  }
  throw httpError('Grok returned unparseable JSON', 502);
}

function grokMessageText(message) {
  // reasoning_content is the scratchpad. It can hold discarded code. Never
  // parse it into files that get committed (advisory premise on #589).
  return message && typeof message.content === 'string' ? message.content : '';
}

function redactModelError(text, apiKey) {
  // Strip the key this request sent before any slice. A gateway can echo a
  // token that matches neither sk- nor Bearer (advisory code on #590).
  // Shorter than 8 characters is not treated as a credential: deleting it
  // would blank ordinary words in the error.
  let out = String(text || '');
  const secret = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (secret.length >= 8) out = out.split(secret).join('[redacted]');
  return out
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-REDACTED')
    .replace(/Bearer\s+\S+/gi, 'Bearer REDACTED')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/** Visible-answer cap. LiteLLM drops max_completion_tokens unless named. */
function completionTokenFields(apiBase) {
  const fields = {
    max_completion_tokens: Number(process.env.XAI_MAX_TOKENS || 65536),
    // Prose such as "I'll read the files" is not a file edit. JSON mode
    // rejects that reply before it can be committed (Decision [2026-10-04-0003]).
    response_format: { type: 'json_object' },
  };
  let host = '';
  try {
    host = new URL(apiBase).host;
  } catch {
    host = '';
  }
  // api.x.ai accepts these fields. The NewPush gateway is LiteLLM and
  // returns 400 for grok-4.6 unless the request names them
  // (Decision [2026-10-04-0002]).
  if (host !== 'api.x.ai') {
    fields.allowed_openai_params = ['max_completion_tokens', 'response_format'];
  }
  return fields;
}

async function listGrokModels({ apiKey, apiBase = XAI_API, fetchImpl = fetch }) {
  const res = await fetchImpl(`${apiBase}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw httpError(`xAI models → ${res.status}`, res.status);
  }
  const body = await res.json();
  return (body.data || []).map((item) => item.id);
}

async function callGrokJson({
  model,
  messages,
  apiKey,
  apiBase = XAI_API,
  fetchImpl = fetch,
  effort = 'xhigh',
}) {
  const res = await fetchImpl(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      reasoning_effort: effort,
      // max_tokens counts thinking and the visible answer together. The
      // completion cap is the visible answer only (Decision [2026-10-04-0001]).
      ...completionTokenFields(apiBase),
    }),
  });
  if (!res.ok) {
    let raw = '';
    try {
      raw = typeof res.text === 'function' ? await res.text() : '';
    } catch {
      raw = '';
    }
    const detail = redactModelError(raw, apiKey);
    const suffix = detail ? `: ${detail}` : '';
    throw httpError(`xAI ${model} → ${res.status}${suffix}`, res.status);
  }
  const body = await res.json();
  const choice = body && body.choices && body.choices[0] ? body.choices[0] : {};
  const message = choice.message || {};
  try {
    return parseJsonObject(grokMessageText(message));
  } catch (err) {
    if (!err || err.status !== 502) throw err;
    const contentLen = typeof message.content === 'string' ? message.content.length : 0;
    const reasoningLen = typeof message.reasoning_content === 'string' ? message.reasoning_content.length : 0;
    const preview = redactModelError(typeof message.content === 'string' ? message.content : '', apiKey).slice(0, 120);
    const previewSuffix = preview ? `: ${preview}` : '';
    // Same prose on every retry is not a transient outage. 422 is not retried.
    throw httpError(
      `Grok returned unparseable JSON (finish_reason=${choice.finish_reason || 'unknown'}, content_chars=${contentLen}, reasoning_chars=${reasoningLen})${previewSuffix}`,
      422,
    );
  }
}

function formatSource(source) {
  if (source && source.missing) {
    return `Path: ${source.path}\nThis path is not on the base branch. Create it if the plan requires it.`;
  }
  return `Path: ${source.path}\n<file>\n${source.content}\n</file>`;
}

function githubContentsPath(repo, filePath, ref) {
  const encoded = String(filePath || '').split('/').map((part) => encodeURIComponent(part)).join('/');
  return `/repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`;
}

const MAX_SOURCE_CHARS = 100000;

async function loadBaseFiles({ repo, ref, files, token, ghImpl } = {}) {
  const call = ghImpl || require('../scripts/github-client.js').gh;
  const sources = [];
  for (const filePath of files || []) {
    let payload;
    try {
      payload = await call(githubContentsPath(repo, filePath, ref), { token });
    } catch (err) {
      if (err && err.status === 404) {
        sources.push({ path: filePath, missing: true });
        continue;
      }
      throw err;
    }
    if (!payload || payload.type !== 'file' || payload.encoding !== 'base64' || typeof payload.content !== 'string') {
      return { ok: false, reason: 'writer-source-not-file', path: filePath };
    }
    const content = Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf8');
    if (content.length > MAX_SOURCE_CHARS) {
      return { ok: false, reason: 'writer-source-too-large', path: filePath };
    }
    if (!sourceAllowedDespiteScan(content)) {
      return { ok: false, reason: 'writer-source-scan-blocked', path: filePath };
    }
    sources.push({ path: filePath, content });
  }
  return { ok: true, sources };
}

function buildWriterPrompt({ issue, plan, profile, sources } = {}) {
  const { resolveProfile } = require('./profile.js');
  const resolved = resolveProfile(profile && profile.id ? profile.id : profile);
  const allow = (plan.files || []).map((file) => `- ${file}`).join('\n');
  const specLines = resolved.id === 'spec'
    ? [
      resolved.templateHint,
      'Skill: orchestration/spec-author. Mandatory sections must be substantive. No placeholders.',
      'Do not write GEMINI.md, CLAUDE.md, or skills-dist/ — generate_all.js owns those.',
    ]
    : [];
  const loaded = Array.isArray(sources) ? sources : [];
  return [
    'Implement ONLY the accepted plan. Return JSON only:',
    '{"summary":"...","files":[{"path":"...","content":"..."}]}',
    'You have no tools and no later turn. Do not say you will read files.',
    'Every path must be in the allow-list. Send complete file contents, not patches.',
    'Do not invent paths. Do not touch governance carve-outs. Do not include secrets.',
    ...specLines,
    '',
    `Issue: ${(issue && issue.title) || ''}`,
    '',
    'Allow-list:',
    allow || '- (none)',
    '',
    '<plan>',
    plan.plan || '',
    '</plan>',
    '',
    'Current files on the base branch:',
    loaded.length ? loaded.map(formatSource).join('\n\n') : '(none loaded)',
  ].join('\n');
}

async function draftChanges({
  issue,
  plan,
  env = process.env,
  callModel,
  fetchImpl,
  profile,
  repo,
  base,
  token,
  ghImpl,
  sources: seededSources,
} = {}) {
  if (!plan || plan.status !== 'accepted') {
    return { status: 'refused', reason: 'plan-not-accepted', files: [] };
  }
  let sources = Array.isArray(seededSources) ? seededSources : [];
  if (typeof callModel !== 'function' && (repo || base || token)) {
    if (!repo || !base || !token) {
      return { status: 'refused', reason: 'writer-source-unavailable', files: [] };
    }
    const loaded = await loadBaseFiles({
      repo,
      ref: base,
      files: plan.files,
      token,
      ghImpl,
    });
    if (!loaded.ok) return { status: 'refused', reason: loaded.reason, files: [] };
    sources = loaded.sources;
  }
  const invoke = typeof callModel === 'function'
    ? () => callModel({ issue, plan })
    : async () => {
      const auth = resolveWriterAuth(env);
      const ids = await listGrokModels({ apiKey: auth.apiKey, apiBase: auth.apiBase, fetchImpl });
      const chosen = selectGrokModel(ids, { pin: env.XAI_CODE_MODEL || auth.pinDefault || '' });
      const reply = await callGrokJson({
        model: chosen.id,
        messages: [
          { role: 'system', content: 'You are noemi-agent. You have no tools. Reply with one JSON object and no other text.' },
          { role: 'user', content: buildWriterPrompt({ issue, plan, profile, sources }) },
        ],
        apiKey: auth.apiKey,
        apiBase: auth.apiBase,
        fetchImpl,
      });
      return { ...reply, model: chosen.id };
    };

  const reply = await withRetry(invoke, modelRetryOptions());
  const files = reply && Array.isArray(reply.files) ? reply.files : [];
  const checked = validateFiles(files, plan, profile, sources);
  if (!checked.ok) {
    return { status: 'refused', reason: checked.reason, files: [], model: reply && reply.model };
  }
  return {
    status: 'ready',
    reason: 'drafted',
    files,
    model: reply.model || null,
    summary: reply.summary || '',
  };
}

module.exports = {
  CARVE_OUT,
  MAX_FILES,
  XAI_API,
  NEWPUSH_AI_GW_V1,
  DEFAULT_GW_GROK_MODEL,
  assertWriterKey,
  buildWriterPrompt,
  classifyGrok,
  draftChanges,
  isCarvedOut,
  normalizeApiBase,
  normalizeRepoPath,
  resolveWriterAuth,
  grokMessageText,
  parseJsonObject,
  selectGrokModel,
  stripProviderPrefix,
  validateFiles,
};
