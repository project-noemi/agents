'use strict';

/**
 * Layer compliance (docs/configuration-layers.md § Compliance).
 *
 * Later layers win on conflict, with one exception: core rules (secrets.*,
 * refusal.*) are non-relaxable. A layer may clarify or tighten a core rule but
 * never loosen it, and there is no waiver or downgrade path. The audit scores
 * each layer:
 *
 *   FAIL  any attempt to relax a core rule: a `relax` marker, an unknown or
 *         malformed marker that names a core rule, or a line that reads like a
 *         relaxation of a core rule (keyword heuristic, marked or not)
 *   WARN  relaxing a preference rule; an unknown rule ID; a malformed marker
 *         that names no core rule
 *   PASS  clarifications and tightenings, which loosen no prohibition
 *
 * Baseline rules carry stable IDs in AGENTS.md:
 *   <!-- rule: secrets.no-hardcode -->                 core (default)
 *   <!-- rule: coding.branch-naming (preference) -->   preference
 * A layer declares an override by ID:
 *   <!-- override: coding.model-baseline relax -->     (or clarify / tighten)
 */

const fs = require('fs');
const path = require('path');
const { EXAMPLE_LAYER, LOCAL_LAYER, resolveLayers } = require('./context_layers');

const RULE_ID = '[a-z0-9]+(?:[.-][a-z0-9]+)+';
const RULE_MARKER = new RegExp(`<!--\\s*rule:\\s*(${RULE_ID})\\s*(?:\\((core|preference)\\))?\\s*-->`, 'g');
// Any comment that starts with "override:" is parsed, so a malformed marker
// (missing action, bad ID) is reported instead of silently ignored.
const OVERRIDE_COMMENT = /<!--\s*override:([\s\S]*?)-->/g;
const OVERRIDE_BODY = new RegExp(`^\\s*(${RULE_ID})\\s+([a-z]+)\\s*$`, 'i');
const OVERRIDE_ACTIONS = new Set(['relax', 'clarify', 'tighten']);
const CORE_PREFIXES = ['secrets.', 'refusal.'];

/** Core rules the baseline must always tag. Losing one is a FAIL. */
const REQUIRED_CORE_RULES = [
    'secrets.no-ask-user',
    'secrets.no-hardcode',
    'secrets.fetch-on-demand',
    'refusal.principle',
    'refusal.criteria-mandatory'
];

/**
 * Keyword heuristic for wording that loosens a core rule. It runs on every
 * line of a layer, including lines that carry a `clarify` or `tighten`
 * marker, so a marker cannot launder a relaxation. Free-text matching misses
 * some rewordings; reviewers of the layer change remain the primary check.
 */
const PERMISSION = '\\b(?:may|can|could|allowed to|ok to|okay to|permitted to|is fine to|feel free to)\\b';
const HEURISTICS = [
    { rule: 'secrets.no-hardcode', pattern: new RegExp(`${PERMISSION}[^.\\n]{0,60}\\bhard-?cod`, 'i') },
    { rule: 'secrets.no-ask-user', pattern: new RegExp(`${PERMISSION}[^.\\n]{0,60}\\b(?:ask|prompt|request)\\b[^.\\n]{0,40}\\b(?:secrets?|passwords?|tokens?|api keys?|credentials?)\\b`, 'i') },
    { rule: 'secrets.no-ask-user', pattern: /\bpaste\b[^.\n]{0,30}\b(?:secrets?|passwords?|tokens?|api keys?|credentials?)\b/i },
    { rule: 'secrets.fetch-on-demand', pattern: new RegExp(`${PERMISSION}[^.\\n]{0,60}\\b(?:write|store|save|commit|keep)\\b[^.\\n]{0,40}(?:\\bsecrets?\\b|\\bcredentials?\\b|\\btokens?\\b|\\.env\\b)`, 'i') },
    { rule: 'secrets.fetch-on-demand', pattern: /\b(?:skip|bypass|instead of|without)\b[^.\n]{0,30}\b(?:infisical run|op run)\b/i },
    { rule: 'refusal.principle', pattern: /\b(?:ignore|disable|skip|bypass|remove|drop)\b[^.\n]{0,40}\brefusal\b/i }
];
const NEGATION = /\b(?:not|never|no|must not|cannot|can't|don't|do not)\b/i;

function isCoreRuleId(id) {
    return CORE_PREFIXES.some((prefix) => String(id).startsWith(prefix));
}

/** Parse rule markers from baseline text. Returns { rules: Map, errors }. */
function parseBaselineRules(text) {
    const rules = new Map();
    const errors = [];
    String(text).split(/\r?\n/).forEach((line, index) => {
        for (const match of line.matchAll(RULE_MARKER)) {
            const id = match[1];
            if (rules.has(id)) {
                errors.push(`AGENTS.md:${index + 1}: duplicate rule ID "${id}".`);
                continue;
            }
            rules.set(id, { id, tier: match[2] || 'core', line: index + 1 });
        }
    });
    return { rules, errors };
}

/**
 * Parse override markers from a layer. Returns [{ rule, action, line }];
 * a marker that does not match "<rule-id> <action>" yields { malformed, raw }.
 */
function parseOverrides(text) {
    const overrides = [];
    String(text).split(/\r?\n/).forEach((line, index) => {
        for (const match of line.matchAll(OVERRIDE_COMMENT)) {
            const body = match[1];
            const parsed = body.match(OVERRIDE_BODY);
            if (parsed) {
                overrides.push({ rule: parsed[1], action: parsed[2].toLowerCase(), line: index + 1 });
            } else {
                overrides.push({ malformed: true, raw: body.trim(), line: index + 1 });
            }
        }
    });
    return overrides;
}

/** Keyword heuristic over every line of a layer (markers do not exempt a line). */
function scanHeuristics(text) {
    const hits = [];
    String(text).split(/\r?\n/).forEach((line, index) => {
        const prose = line.replace(OVERRIDE_COMMENT, ' ');
        for (const heuristic of HEURISTICS) {
            const match = prose.match(heuristic.pattern);
            if (match && !NEGATION.test(match[0])) {
                hits.push({ rule: heuristic.rule, line: index + 1, excerpt: prose.trim().slice(0, 160) });
                break;
            }
        }
    });
    return hits;
}

/**
 * Evaluate compliance for a checkout. Pure apart from file reads.
 * Returns { findings: [{ level, message, rule?, layer?, heuristic? }], layers }.
 */
function evaluateLayerCompliance({ repoRoot, env = process.env }) {
    const findings = [];
    const add = (level, message, extra = {}) => findings.push({ level, message, ...extra });

    // 1. Baseline rule IDs: every core rule stays tagged, and stays core.
    const { rules, errors: ruleErrors } = parseBaselineRules(fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8'));
    for (const message of ruleErrors) {
        add('FAIL', message);
    }
    for (const id of REQUIRED_CORE_RULES) {
        const rule = rules.get(id);
        if (!rule) {
            add('FAIL', `AGENTS.md is missing the stable rule ID marker "<!-- rule: ${id} -->".`, { rule: id });
        } else if (rule.tier !== 'core') {
            add('FAIL', `AGENTS.md marks "${id}" as ${rule.tier}; it must stay a core rule.`, { rule: id });
        }
    }
    for (const rule of rules.values()) {
        if (isCoreRuleId(rule.id) && rule.tier !== 'core' && !REQUIRED_CORE_RULES.includes(rule.id)) {
            add('FAIL', `AGENTS.md marks "${rule.id}" as ${rule.tier}; secrets.* and refusal.* rules are always core.`, { rule: rule.id });
        }
    }
    const isCore = (id) => isCoreRuleId(id) || rules.get(id)?.tier === 'core';

    // 2. Active layers: declared overrides + heuristic.
    let resolved;
    try {
        resolved = resolveLayers({ repoRoot, env });
    } catch (error) {
        add('FAIL', error.message);
        resolved = { present: [], local: false, errors: [] };
    }
    const layers = resolved.errors.length ? [] : [...resolved.present];
    if (resolved.local) {
        layers.push(LOCAL_LAYER);
    }

    for (const layer of layers) {
        const text = fs.readFileSync(path.join(repoRoot, layer), 'utf8');
        for (const override of parseOverrides(text)) {
            const where = `${layer}:${override.line}`;
            if (override.malformed) {
                const namesCore = new RegExp(`\\b(?:${CORE_PREFIXES.map((p) => p.replace('.', '\\.')).join('|')})`, 'i').test(override.raw);
                add(namesCore ? 'FAIL' : 'WARN',
                    `${where}: malformed override marker "override:${override.raw}" (expected "<!-- override: <rule-id> relax|clarify|tighten -->")`
                    + (namesCore ? '; markers that name a core rule must be a valid clarify or tighten.' : '.'), { layer });
                continue;
            }
            const rule = rules.get(override.rule);
            const core = isCore(override.rule);
            if (core && override.action !== 'clarify' && override.action !== 'tighten') {
                add('FAIL', `${where}: "${override.action}" on core rule ${override.rule}. Core rules (secrets.*, refusal.*) cannot be relaxed by a layer; only clarify or tighten is allowed.`, { rule: override.rule, layer });
                continue;
            }
            if (!OVERRIDE_ACTIONS.has(override.action)) {
                add('WARN', `${where}: override of "${override.rule}" uses unknown action "${override.action}" (use relax, clarify or tighten).`, { rule: override.rule, layer });
                continue;
            }
            if (!rule) {
                add(core ? 'FAIL' : 'WARN', `${where}: override references unknown rule ID "${override.rule}".`, { rule: override.rule, layer });
                continue;
            }
            if (override.action !== 'relax') {
                add('PASS', `${where}: ${override.action}s ${rule.id} (no prohibition loosened).`, { rule: rule.id, layer });
                continue;
            }
            add('WARN', `${where}: relaxes preference rule ${rule.id}.`, { rule: rule.id, layer });
        }
        for (const hit of scanHeuristics(text)) {
            add('FAIL', `${layer}:${hit.line}: wording reads as a relaxation of core rule ${hit.rule}: "${hit.excerpt}". Core rules cannot be relaxed by a layer; reword the line.`, { rule: hit.rule, layer, heuristic: true });
        }
    }

    // 3. Template: markers must be valid and may not relax a core rule.
    const templatePath = path.join(repoRoot, EXAMPLE_LAYER);
    if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf8');
        for (const override of parseOverrides(template)) {
            const invalid = override.malformed || !OVERRIDE_ACTIONS.has(override.action) || !rules.has(override.rule);
            const relaxesCore = !override.malformed && isCore(override.rule) && override.action === 'relax';
            if (invalid || relaxesCore) {
                const shown = override.malformed ? override.raw : `${override.rule} ${override.action}`;
                add('FAIL', `${EXAMPLE_LAYER}:${override.line}: template override marker "${shown}" is invalid.`);
            }
        }
        for (const hit of scanHeuristics(template)) {
            add('FAIL', `${EXAMPLE_LAYER}:${hit.line}: template wording reads as a relaxation of core rule ${hit.rule}.`);
        }
    }

    return { findings, layers };
}

module.exports = {
    CORE_PREFIXES,
    HEURISTICS,
    OVERRIDE_ACTIONS,
    REQUIRED_CORE_RULES,
    evaluateLayerCompliance,
    isCoreRuleId,
    parseBaselineRules,
    parseOverrides,
    scanHeuristics
};
