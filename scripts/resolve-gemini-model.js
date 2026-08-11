#!/usr/bin/env node
/**
 * Resolve the highest-capability Gemini model currently available for deep
 * review, by querying the API rather than trusting a name written into config.
 *
 * WHY NOT PIN A MODEL
 *   CLAUDE.md pins `models/gemini-2.5-flash` for reference workflows, lab
 *   examples, and smoke tests, where predictable cost and determinism are the
 *   point. That pin is correct there and is deliberately NOT changed by this
 *   script.
 *
 *   Review is a different job. It wants maximum capability, and any model name
 *   hardcoded today is stale later — pinning 2.5 in 2026-04 is why a 3.x
 *   generation went unused. So review discovers what exists at runtime and
 *   ranks it, rather than naming a winner in advance.
 *
 * WHAT IT COSTS
 *   Discovery trades reproducibility for capability: a review that passed on
 *   one model cannot be re-run identically later. The mitigation is that the
 *   resolved model ID and timestamp are returned here and recorded in the
 *   review's audit log, so a verdict is always attributable to what produced
 *   it. See docs/AI_REVIEW_GOVERNANCE.md.
 *
 * RANKING
 *   Capability tier first, then generation, then variant:
 *     tier:       pro > flash > flash-lite
 *     reasoning:  thinking/reasoning variants outrank their base model
 *     generation: higher version number wins
 *   Preview and experimental builds are eligible only with --allow-preview,
 *   since an unstable model behind a merge gate is its own risk.
 *
 * USAGE
 *   infisical run --env=dev -- node scripts/resolve-gemini-model.js
 *   node scripts/resolve-gemini-model.js --floor pro --json
 *   node scripts/resolve-gemini-model.js --dry-run   # rank without API access
 *
 * EXIT CODES
 *   0 resolved   1 no model met the floor   2 configuration or API error
 *
 * Fails loudly rather than silently degrading: a deep review performed on a
 * shallow model is worse than no review, because it manufactures confidence
 * that was never earned.
 */

'use strict';

const { getAccessToken, tokenSource } = require('./gcp-token.js');

const TIER_RANK = { pro: 300, flash: 200, 'flash-lite': 100 };
const DEFAULT_FLOOR = process.env.GEMINI_REVIEW_FLOOR || 'flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function parseArgs(argv) {
  const args = { floor: DEFAULT_FLOOR, json: false, allowPreview: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--floor': args.floor = argv[++i]; break;
      case '--json': args.json = true; break;
      case '--allow-preview': args.allowPreview = true; break;
      case '--dry-run': args.dryRun = true; break;
      case '--help':
        process.stdout.write('Usage: resolve-gemini-model.js [--floor pro|flash|flash-lite] [--json] [--allow-preview] [--dry-run]\n');
        process.exit(0);
        break;
      default:
        if (argv[i].startsWith('--')) {
          process.stderr.write(`Unknown flag: ${argv[i]}\n`);
          process.exit(2);
        }
    }
  }
  return args;
}

/**
 * Classify a model ID into ranking components. Deliberately pattern-based, not
 * an allowlist of known names — an allowlist would reintroduce the staleness
 * this script exists to avoid, silently ignoring any future generation.
 */
function classify(id) {
  // Strip both shapes: `models/x` (Generative Language API) and
  // `publishers/google/models/x` (Vertex AI).
  const name = id.replace(/^publishers\/[^/]+\/models\//, '').replace(/^models\//, '');
  if (!/^gemini-/.test(name)) return null;

  const versionMatch = name.match(/gemini-(\d+(?:\.\d+)?)/);
  const generation = versionMatch ? parseFloat(versionMatch[1]) : 0;

  let tier = 'flash';
  if (/flash-lite/.test(name)) tier = 'flash-lite';
  else if (/\bpro\b|-pro/.test(name)) tier = 'pro';
  else if (/flash/.test(name)) tier = 'flash';

  const reasoning = /thinking|reasoning/.test(name);
  const preview = /preview|exp(erimental)?|-rc|latest/.test(name);

  return { id, name, generation, tier, reasoning, preview };
}

function scoreOf(m) {
  // Tier dominates, then generation, then a reasoning bonus that can lift a
  // thinking variant above its own base model but never above a higher tier.
  return (TIER_RANK[m.tier] || 0) * 1000 + m.generation * 10 + (m.reasoning ? 5 : 0);
}

function rank(models, { allowPreview }) {
  return models
    .map(classify)
    .filter(Boolean)
    .filter((m) => allowPreview || !m.preview)
    .map((m) => ({ ...m, score: scoreOf(m) }))
    .sort((a, b) => b.score - a.score || b.generation - a.generation);
}

function meetsFloor(model, floor) {
  const floorRank = TIER_RANK[floor];
  if (floorRank === undefined) {
    process.stderr.write(`Unknown floor '${floor}'. Use one of: ${Object.keys(TIER_RANK).join(', ')}\n`);
    process.exit(2);
  }
  return (TIER_RANK[model.tier] || 0) >= floorRank;
}

/** Backend config. Vertex is the default because ADC is its native auth path
 *  and this organization's policy mandates ADC. See docs. */
function backendConfig() {
  const backend = process.env.GEMINI_BACKEND || 'vertex';
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || '';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  if (backend !== 'vertex' && backend !== 'generativelanguage') {
    throw new Error(`Unknown GEMINI_BACKEND '${backend}'. Use 'vertex' or 'generativelanguage'.`);
  }
  if (backend === 'vertex' && !project) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required for the vertex backend.');
  }
  return { backend, project, location };
}

/** Base URL for generateContent against a resolved model id. */
function generateUrl(modelId, cfg) {
  if (cfg.backend === 'generativelanguage') return `${API_BASE}/${modelId}:generateContent`;
  const bare = modelId.replace(/^publishers\/[^/]+\/models\//, '').replace(/^models\//, '');
  return `https://${cfg.location}-aiplatform.googleapis.com/v1/projects/${cfg.project}`
    + `/locations/${cfg.location}/publishers/google/models/${bare}:generateContent`;
}

/**
 * List models that can serve generateContent.
 *
 * Authenticated with an ADC bearer token — never an API key, which this
 * organization's policy disallows.
 */
async function listModels(token, cfg = backendConfig()) {
  const headers = { Authorization: `Bearer ${token}` };
  const out = [];
  let pageToken = '';

  // Paginate: assuming one page is how you silently miss the newest model.
  do {
    const url = cfg.backend === 'generativelanguage'
      ? `${API_BASE}/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`
      : `https://${cfg.location}-aiplatform.googleapis.com/v1/publishers/google/models`
        + `?pageSize=200&filter=name:gemini*${pageToken ? `&pageToken=${pageToken}` : ''}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`ListModels (${cfg.backend}) failed: HTTP ${res.status} ${await res.text()}`);
    }
    const body = await res.json();

    if (cfg.backend === 'generativelanguage') {
      for (const m of body.models || []) {
        if ((m.supportedGenerationMethods || []).includes('generateContent')) out.push(m.name);
      }
    } else {
      // Vertex publisher models do not advertise supportedGenerationMethods
      // uniformly; ranking filters non-Gemini entries anyway.
      for (const m of body.publisherModels || body.models || []) {
        if (m.name) out.push(m.name);
      }
    }

    pageToken = body.nextPageToken || '';
  } while (pageToken);

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.dryRun) {
    // Offline sanity check of the ranking logic. Names here are illustrative
    // inputs only — nothing in this script depends on them existing.
    const sample = [
      'models/gemini-2.5-flash',
      'models/gemini-2.5-pro',
      'models/gemini-3.0-flash',
      'models/gemini-3.6-pro-thinking',
      'models/gemini-3.6-flash',
    ];
    const ranked = rank(sample, args);
    process.stdout.write(`${JSON.stringify({ dryRun: true, ranked }, null, 2)}\n`);
    return;
  }

  // ADC only. This organization's policy disallows API keys and
  // service-account keys, so there is no static-credential path to fall back
  // to — see scripts/gcp-token.js.
  let token;
  let cfg;
  try {
    cfg = backendConfig();
    token = await getAccessToken();
  } catch (err) {
    process.stderr.write(`✖ ${err.message}\n`);
    process.exit(2);
  }

  let available;
  try {
    available = await listModels(token, cfg);
  } catch (err) {
    process.stderr.write(`✖ Could not list models: ${err.message}\n`);
    process.exit(2);
  }

  const ranked = rank(available, args);
  const chosen = ranked.find((m) => meetsFloor(m, args.floor));

  if (!chosen) {
    process.stderr.write(`✖ No available model meets the '${args.floor}' floor.\n`);
    process.stderr.write(`  Considered: ${ranked.map((m) => m.name).join(', ') || '(none)'}\n`);
    process.stderr.write('  Refusing to review on an under-capability model.\n');
    process.exit(1);
  }

  const result = {
    model: chosen.id,
    tier: chosen.tier,
    generation: chosen.generation,
    reasoning: chosen.reasoning,
    resolved_at: new Date().toISOString(),
    floor: args.floor,
    backend: cfg.backend,
    considered: ranked.length,
  };

  // Audit log to stderr, payload to stdout, per CLAUDE.md.
  process.stderr.write(`${JSON.stringify({
    task: 'Resolve highest-capability Gemini model for review',
    inputs: [`floor=${args.floor}`, `allow_preview=${args.allowPreview}`, `backend=${cfg.backend}`, `auth=${tokenSource()}`],
    actions: [`listed ${available.length} models`, `ranked ${ranked.length} candidates`, `selected ${chosen.id}`],
    risks: chosen.preview ? ['selected a preview build'] : [],
    result: chosen.id,
  })}\n`);

  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `${chosen.id}\n`);
}

// Importable as a module so the review runner can reuse the ranking logic
// without shelling out; still runs as a CLI when invoked directly.
module.exports = {
  classify, scoreOf, rank, meetsFloor, listModels,
  backendConfig, generateUrl, TIER_RANK,
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`✖ ${err.stack || err.message}\n`);
    process.exit(2);
  });
}
