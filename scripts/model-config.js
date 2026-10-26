'use strict';

/**
 * One model config for every live model call (writer, critic, reviser,
 * doc-critic, reviewer). A pure function: env in, config out. It never reads
 * the network and never calls gcloud.
 *
 * ROUTES
 *   gateway — the shared NewPush AI gateway (LiteLLM). Main route. One virtual
 *             key reaches xai/* and google/*. Chosen whenever AI_GW_API_TOKEN
 *             or AI_GW_API_KEY is set, even if a provider credential is also
 *             set: one key means the gateway key wins.
 *   native  — per-provider direct access, kept for a tenant with no gateway
 *             key: XAI_API_KEY to api.x.ai for the writer, application-default
 *             credentials to Vertex for Gemini (scripts/gcp-token.js).
 *
 * PINS live only here. Gateway ids keep the provider/id form. A pin the key
 * cannot call is a failed run; no substitute is discovered on the gateway.
 *
 * The native env names (GEMINI_REVIEW_MODEL, GEMINI_CRITIC_MODEL,
 * XAI_CODE_MODEL) keep their native meaning. On the gateway a bare id gets the
 * provider prefix added, and `auto` or empty takes the gateway default, so one
 * vault value works on both routes.
 */

const NEWPUSH_AI_GW = 'https://ai-gw.newpush.com';
const XAI_API = 'https://api.x.ai/v1';

// plan: writes and revises the Stage B plan. critic: red-teams it. Two
// different models on purpose, so the plan is not attacked by its author.
const GATEWAY_DEFAULTS = Object.freeze({
  code: 'xai/grok-4.6',
  plan: 'google/gemini-4-argon',
  critic: 'google/gemini-3.1-pro-preview',
  review: 'google/gemini-3.1-pro-preview',
});

const STAGE_PROVIDER = Object.freeze({
  code: 'xai', plan: 'google', critic: 'google', review: 'google',
});

function trimSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/** OpenAI-compatible base: add /v1 when missing (same rule writer.js used). */
function normalizeApiBase(url) {
  const raw = trimSlash(url);
  if (!raw) return '';
  return /\/v1$/i.test(raw) ? raw : `${raw}/v1`;
}

/** Gateway root: accepts the root, `/v1`, or `/google` and returns the root. */
function gatewayRoot(url) {
  return trimSlash(url).replace(/\/(?:v1|google)$/i, '');
}

function isAuto(value) {
  const v = String(value || '').trim();
  return v === '' || v.toLowerCase() === 'auto';
}

/** A native Gemini or Grok id as a gateway provider/id. */
function toGatewayModel(value, provider) {
  const bare = String(value).trim()
    .replace(/^publishers\/google\/models\//, '')
    .replace(/^models\//, '');
  if (bare.includes('/')) return bare;
  return `${provider}/${bare}`;
}

function stageEnv(stage, env) {
  if (stage === 'code') {
    return env.XAI_CODE_MODEL ? { value: env.XAI_CODE_MODEL, source: 'XAI_CODE_MODEL' } : null;
  }
  if (stage === 'plan') {
    // Provider-neutral: the plan writer's provider is a business choice.
    // `anthropic/<id>` or `xai/<id>` works as well as a Gemini id.
    return env.PLAN_MODEL ? { value: env.PLAN_MODEL, source: 'PLAN_MODEL' } : null;
  }
  if (stage === 'critic') {
    if (env.GEMINI_CRITIC_MODEL) return { value: env.GEMINI_CRITIC_MODEL, source: 'GEMINI_CRITIC_MODEL' };
    if (env.GEMINI_REVIEW_MODEL) return { value: env.GEMINI_REVIEW_MODEL, source: 'GEMINI_REVIEW_MODEL' };
    return null;
  }
  return env.GEMINI_REVIEW_MODEL ? { value: env.GEMINI_REVIEW_MODEL, source: 'GEMINI_REVIEW_MODEL' } : null;
}

/** Provider of a provider/id; a bare id belongs to `fallback`. */
function providerOf(model, fallback) {
  const id = String(model || '');
  return id.includes('/') ? id.split('/')[0] : fallback;
}

function gatewayStage(stage, env) {
  const set = stageEnv(stage, env);
  const model = !set || isAuto(set.value)
    ? GATEWAY_DEFAULTS[stage]
    : toGatewayModel(set.value, STAGE_PROVIDER[stage]);
  return {
    provider: providerOf(model, STAGE_PROVIDER[stage]),
    model,
    source: !set || isAuto(set.value) ? 'default' : set.source,
  };
}

function nativeStage(stage, env) {
  const set = stageEnv(stage, env);
  // Native pins stay raw. writer.selectGrokModel and resolvePinnedModel own
  // catalogue matching; `auto` or empty means discover.
  const model = set && !isAuto(set.value) ? String(set.value).trim() : '';
  const prefixed = /^(?:anthropic|xai|google|openai)\//.test(model);
  return {
    provider: prefixed ? providerOf(model, STAGE_PROVIDER[stage]) : STAGE_PROVIDER[stage],
    model,
    source: set && !isAuto(set.value) ? set.source : 'discover',
  };
}

function loadModelConfig(env = process.env) {
  const e = env || {};
  const xai = e.XAI_API_KEY
    ? { apiKey: e.XAI_API_KEY, apiBase: normalizeApiBase(e.XAI_API_BASE) || XAI_API, source: 'XAI_API_KEY' }
    : null;
  const gwKey = e.AI_GW_API_TOKEN || e.AI_GW_API_KEY;
  if (gwKey) {
    const root = gatewayRoot(e.AI_GW_BASE_URL || e.AI_GW_API_BASE) || NEWPUSH_AI_GW;
    return {
      mode: 'gateway',
      gateway: {
        apiKey: gwKey,
        source: e.AI_GW_API_TOKEN ? 'AI_GW_API_TOKEN' : 'AI_GW_API_KEY',
        root,
        openaiBase: `${root}/v1`,
        googleBase: `${root}/google`,
      },
      xai,
      stages: {
        code: gatewayStage('code', e),
        plan: gatewayStage('plan', e),
        critic: gatewayStage('critic', e),
        review: gatewayStage('review', e),
      },
    };
  }
  return {
    mode: 'native',
    gateway: null,
    xai,
    stages: {
      code: nativeStage('code', e),
      plan: nativeStage('plan', e),
      critic: nativeStage('critic', e),
      review: nativeStage('review', e),
    },
  };
}

module.exports = {
  GATEWAY_DEFAULTS,
  NEWPUSH_AI_GW,
  XAI_API,
  gatewayRoot,
  loadModelConfig,
  normalizeApiBase,
  providerOf,
  toGatewayModel,
};
