#!/usr/bin/env node
/**
 * Resolve the highest-capability Gemini model currently available for deep
 * review, by querying the API rather than trusting a name written into config.
 *
 * WHY NOT PIN A MODEL
 *   CLAUDE.md pins `models/gemini-3.6-flash` for reference workflows, lab
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
 * SELECTION RULE (owner decision 2026-08-15, Decision [2026-08-15-0003])
 *   Review floor is `pro`. Flash is not adequate for a thorough review.
 *   Among models that meet the floor, prefer the newest stable generation;
 *   Pro is elevated within that generation. A catalogue with no Pro fails
 *   loudly instead of running on Flash.
 *
 *   --prefer-pro / GEMINI_PREFER_PRO=1 (`prefer_pro_tier` / `force_pro`) makes
 *   Pro dominant instead. Selection may then fall back to an older stable Pro,
 *   or with --allow-preview a preview Pro. Any generation regression caused by
 *   the toggle is reported explicitly, because the rule requires the trade-off
 *   to be visible rather than implicit.
 *
 *   Preview builds need --allow-preview: an unstable model inside a governance
 *   control is its own risk.
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
const DEFAULT_FLOOR = process.env.GEMINI_REVIEW_FLOOR || 'pro';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function parseArgs(argv) {
  const args = {
    floor: DEFAULT_FLOOR, json: false, allowPreview: false, dryRun: false,
    // `prefer_pro_tier` / `force_pro`: an explicit toggle, not a hidden weight.
    preferPro: /^(1|true|yes)$/i.test(process.env.GEMINI_PREFER_PRO || ''),
  };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--floor': args.floor = argv[++i]; break;
      case '--json': args.json = true; break;
      case '--allow-preview': args.allowPreview = true; break;
      case '--prefer-pro':
      case '--force-pro': args.preferPro = true; break;
      case '--dry-run': args.dryRun = true; break;
      case '--help':
        process.stdout.write('Usage: resolve-gemini-model.js [--floor pro|flash|flash-lite] [--json] [--allow-preview] [--prefer-pro] [--dry-run]\n');
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
 * Model families that cannot do the job. Reviewing code is a text task, but the
 * Gemini family also publishes image, speech, embedding, robotics, and
 * computer-use variants whose names still contain "pro" or "flash" — so a
 * tier-based ranking will happily select `gemini-3-pro-image` to review a diff.
 *
 * Found by ranking the real published list rather than by reasoning: synthetic
 * test names had no modality suffixes, so the defect was invisible until the
 * live catalogue was ranked.
 */
const NON_TEXT_MODALITY = /(?:^|-)(?:image|tts|audio|embedding|robotics|omni)|computer-use|live-|-info$/;

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
  if (NON_TEXT_MODALITY.test(name)) return null;

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

/**
 * Selection rule (owner decision 2026-08-11):
 *
 *   Prefer the newest stable model of the highest available generation. Pro is
 *   elevated only when a stable Pro exists in that generation; otherwise take
 *   the best stable model of the latest generation.
 *
 * Generation therefore dominates, and tier orders *within* a generation — so a
 * Pro is naturally chosen when one exists at the newest generation, without a
 * hard-coded weight that drags selection backwards when one does not.
 *
 * The earlier tier-dominant weighting had exactly that flaw: with the live
 * catalogue, every 3.x Pro is preview-only, so tier-dominance selected
 * `gemini-2.5-pro` — a full generation behind the newest stable model — while
 * appearing to honour "prefer Pro".
 *
 * `preferPro` makes that trade-off an explicit, caller-visible choice rather
 * than a silent property of the weights.
 */
function compareModels(a, b, preferPro) {
  if (preferPro) {
    const aPro = a.tier === 'pro' ? 1 : 0;
    const bPro = b.tier === 'pro' ? 1 : 0;
    if (aPro !== bPro) return bPro - aPro;
  }
  if (a.generation !== b.generation) return b.generation - a.generation;
  const tier = (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0);
  if (tier !== 0) return tier;
  return (b.reasoning ? 1 : 0) - (a.reasoning ? 1 : 0);
}

/**
 * @param {string[]} models raw model ids
 * @param {{allowPreview?: boolean, preferPro?: boolean}} opts
 *        preferPro — the `prefer_pro_tier` / `force_pro` toggle. When on, Pro
 *        outranks everything, so selection may fall back to an older stable Pro
 *        or (with allowPreview) a preview Pro. The caller accepts that.
 */
function rank(models, { allowPreview = false, preferPro = false } = {}) {
  return models
    .map(classify)
    .filter(Boolean)
    .filter((m) => allowPreview || !m.preview)
    .sort((a, b) => compareModels(a, b, preferPro));
}

/**
 * Resolve one model and describe what the choice cost.
 *
 * The rule requires the Pro preference to be *user-visible*, so when the toggle
 * selects an older generation than the default rule would, that regression is
 * reported rather than left for someone to discover in an audit log.
 */
function selectModel(models, { allowPreview = false, preferPro = false, floor = 'pro' } = {}) {
  const eligible = (opts) => rank(models, opts).filter((m) => meetsFloor(m, floor));

  const chosen = eligible({ allowPreview, preferPro })[0] || null;
  if (!chosen) return { chosen: null, tradeoff: null };

  let tradeoff = null;
  if (preferPro) {
    const withoutToggle = eligible({ allowPreview, preferPro: false })[0];
    if (withoutToggle && withoutToggle.generation > chosen.generation) {
      tradeoff = `prefer_pro_tier selected ${chosen.name} (gen ${chosen.generation}); `
        + `without it the newest stable choice is ${withoutToggle.name} (gen ${withoutToggle.generation}).`;
    }
  }
  return { chosen, tradeoff };
}

function meetsFloor(model, floor) {
  const floorRank = TIER_RANK[floor];
  if (floorRank === undefined) {
    process.stderr.write(`Unknown floor '${floor}'. Use one of: ${Object.keys(TIER_RANK).join(', ')}\n`);
    process.exit(2);
  }
  return (TIER_RANK[model.tier] || 0) >= floorRank;
}

/**
 * Host for a Vertex location. `global` is NOT a region prefix — it is served by
 * the bare host, so `global-aiplatform.googleapis.com` does not resolve.
 */
function vertexHost(location) {
  return location === 'global'
    ? 'aiplatform.googleapis.com'
    : `${location}-aiplatform.googleapis.com`;
}

/** Backend config. Vertex is the default because ADC is its native auth path
 *  and this organization's policy mandates ADC. See docs.
 *
 *  Location defaults to `global` because the publisher catalogue is global while
 *  regional availability lags it: gemini-3.5 and 3.6 are listed everywhere but
 *  return 404 in us-central1, where only the 2.5 generation is served. Verified
 *  empirically. Defaulting to a region therefore made discovery select a model
 *  that could not answer. */
function backendConfig() {
  const backend = process.env.GEMINI_BACKEND || 'vertex';
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || '';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
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
  return `https://${vertexHost(cfg.location)}/v1/projects/${cfg.project}`
    + `/locations/${cfg.location}/publishers/google/models/${bare}:generateContent`;
}

/**
 * List models that can serve generateContent.
 *
 * Authenticated with an ADC bearer token — never an API key, which this
 * organization's policy disallows.
 */
async function listModels(token, cfg = backendConfig()) {
  // The publisher-models list is NOT project-scoped in its path, so it requires
  // an explicit quota project; generateContent carries the project in its URL
  // and does not. Verified empirically: without this header the same request
  // returns 403 "requires a quota project".
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(cfg.project ? { 'x-goog-user-project': cfg.project } : {}),
  };
  const out = [];
  let pageToken = '';

  // Paginate: assuming one page is how you silently miss the newest model.
  do {
    const url = cfg.backend === 'generativelanguage'
      ? `${API_BASE}/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`
      // v1beta1, not v1 — v1 returns 404 for this collection. Verified against
      // the live API. No name filter: the server-side filter is unreliable
      // here and classify() discards non-Gemini entries anyway.
      : `https://${vertexHost(cfg.location)}/v1beta1/publishers/google/models`
        + `?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`;

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
  const { chosen, tradeoff } = selectModel(available, args);

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
    prefer_pro_tier: args.preferPro,
    ...(tradeoff ? { tradeoff } : {}),
    considered: ranked.length,
  };

  // Audit log to stderr, payload to stdout, per CLAUDE.md.
  process.stderr.write(`${JSON.stringify({
    task: 'Resolve highest-capability Gemini model for review',
    inputs: [`floor=${args.floor}`, `allow_preview=${args.allowPreview}`, `prefer_pro_tier=${args.preferPro}`, `backend=${cfg.backend}`, `auth=${tokenSource()}`],
    actions: [`listed ${available.length} models`, `ranked ${ranked.length} candidates`, `selected ${chosen.id}`],
    risks: [
      ...(chosen.preview ? ['selected a preview build'] : []),
      ...(tradeoff ? [tradeoff] : []),
    ],
    result: chosen.id,
  })}\n`);

  if (tradeoff) process.stderr.write(`⚠ ${tradeoff}\n`);
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `${chosen.id}\n`);
}

// Importable as a module so the review runner can reuse the ranking logic
// without shelling out; still runs as a CLI when invoked directly.
module.exports = {
  classify, rank, compareModels, selectModel, meetsFloor, listModels,
  backendConfig, generateUrl, vertexHost, TIER_RANK, NON_TEXT_MODALITY,
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`✖ ${err.stack || err.message}\n`);
    process.exit(2);
  });
}
