'use strict';

/**
 * Stage C Grok writer. Drafts file contents for an accepted plan.
 * Does not open a PR — that is dispatch.openImplementationPr with AGENT_GH_TOKEN.
 */

const { withRetry } = require('../scripts/resilience_helpers.js');
const { scanIssueBody } = require('./scan.js');
const { httpError, modelRetryOptions } = require('./http.js');

const XAI_API = 'https://api.x.ai/v1';
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

function assertWriterKey(env = process.env) {
  const key = env && env.XAI_API_KEY;
  if (!key) {
    const err = new Error('Stage C --open-pr requires XAI_API_KEY (Fetch-on-Demand).');
    err.status = 400;
    throw err;
  }
  return key;
}

function classifyGrok(id) {
  const name = String(id || '').replace(/^models\//, '');
  if (!/^grok-/.test(name)) return null;
  if (/(?:vision|image|tts|audio|voice|realtime|video)/.test(name)) return null;
  const versionMatch = name.match(/grok-(\d+(?:\.\d+)?)/);
  const generation = versionMatch ? parseFloat(versionMatch[1]) : 0;
  const preview = /preview|exp(erimental)?|-rc|beta/.test(name);
  const slim = /mini|fast|lite|nano/.test(name);
  return { id: name, generation, preview, slim };
}

function selectGrokModel(ids, { pin } = {}) {
  const classified = (Array.isArray(ids) ? ids : []).map(classifyGrok).filter(Boolean);
  if (pin && pin !== 'auto') {
    const want = String(pin).replace(/^models\//, '');
    const hit = classified.find((item) => item.id === want);
    if (!hit) {
      throw httpError(`Pinned XAI_CODE_MODEL '${want}' is not in the xAI catalogue`, 400);
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

function validateFiles(files, plan, profile) {
  const { pathAllowedByProfile } = require('./profile.js');
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
    const scan = scanIssueBody(file.content);
    if (scan.status === 'BLOCKED') {
      return { ok: false, reason: 'writer-scan-blocked' };
    }
  }
  return { ok: true };
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = String(text).indexOf('{');
    const end = String(text).lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw httpError('Grok returned unparseable JSON', 502);
  }
}

async function listGrokModels({ apiKey, fetchImpl = fetch }) {
  const res = await fetchImpl(`${XAI_API}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw httpError(`xAI models → ${res.status}`, res.status);
  }
  const body = await res.json();
  return (body.data || []).map((item) => item.id);
}

async function callGrokJson({ model, messages, apiKey, fetchImpl = fetch, effort = 'xhigh' }) {
  const res = await fetchImpl(`${XAI_API}/chat/completions`, {
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
    }),
  });
  if (!res.ok) {
    throw httpError(`xAI ${model} → ${res.status}`, res.status);
  }
  const body = await res.json();
  const text = body && body.choices && body.choices[0] && body.choices[0].message
    ? body.choices[0].message.content
    : '';
  return parseJsonObject(text);
}

function buildWriterPrompt({ issue, plan, profile }) {
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
  return [
    'Implement ONLY the accepted plan. Return JSON only:',
    '{"summary":"...","files":[{"path":"...","content":"..."}]}',
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
  ].join('\n');
}

async function draftChanges({ issue, plan, env = process.env, callModel, fetchImpl, profile } = {}) {
  if (!plan || plan.status !== 'accepted') {
    return { status: 'refused', reason: 'plan-not-accepted', files: [] };
  }
  const invoke = typeof callModel === 'function'
    ? () => callModel({ issue, plan })
    : async () => {
      const apiKey = assertWriterKey(env);
      const ids = await listGrokModels({ apiKey, fetchImpl });
      const chosen = selectGrokModel(ids, { pin: env.XAI_CODE_MODEL || '' });
      const reply = await callGrokJson({
        model: chosen.id,
        messages: [
          { role: 'system', content: 'You are noemi-agent implementing one accepted plan. JSON only.' },
          { role: 'user', content: buildWriterPrompt({ issue, plan, profile }) },
        ],
        apiKey,
        fetchImpl,
      });
      return { ...reply, model: chosen.id };
    };

  const reply = await withRetry(invoke, modelRetryOptions());
  const files = reply && Array.isArray(reply.files) ? reply.files : [];
  const checked = validateFiles(files, plan, profile);
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
  assertWriterKey,
  buildWriterPrompt,
  classifyGrok,
  draftChanges,
  isCarvedOut,
  normalizeRepoPath,
  selectGrokModel,
  validateFiles,
};
