'use strict';

/**
 * Layer compliance (docs/configuration-layers.md § Compliance).
 *
 * Layers may override any baseline rule; later layers win. Compliance does not
 * block that. It reports every loosened rule on every run, at a severity that
 * depends on WHAT was loosened:
 *
 *   FAIL  unwaived relaxation of a core rule (secrets.*, refusal.*)
 *   WARN  waived core relaxation (also listed under Waivers), relaxation of a
 *         preference rule, an unknown rule ID, or a keyword-heuristic hit
 *   PASS  clarifications and tightenings, which change no prohibition
 *
 * Baseline rules carry stable IDs in AGENTS.md:
 *   <!-- rule: secrets.no-hardcode -->                 core (default)
 *   <!-- rule: coding.branch-naming (preference) -->   preference
 * A layer declares an override by ID:
 *   <!-- override: secrets.no-hardcode relax -->       (or clarify / tighten)
 * Waivers live in AGENTS.waivers.json (committed downstream).
 */

const fs = require('fs');
const path = require('path');
const { EXAMPLE_LAYER, LOCAL_LAYER, resolveLayers, validateLayerPath } = require('./context_layers');

const WAIVERS_FILE = 'AGENTS.waivers.json';
const WAIVERS_EXAMPLE_FILE = 'AGENTS.waivers.example.json';
const RULE_ID = '[a-z0-9]+(?:[.-][a-z0-9]+)+';
const RULE_MARKER = new RegExp(`<!--\\s*rule:\\s*(${RULE_ID})\\s*(?:\\((core|preference)\\))?\\s*-->`, 'g');
// Any comment that starts with "override:" is parsed, so a malformed marker
// (missing action, bad ID) is reported instead of silently ignored.
const OVERRIDE_COMMENT = /<!--\s*override:([\s\S]*?)-->/g;
const OVERRIDE_BODY = new RegExp(`^\\s*(${RULE_ID})\\s+([a-z]+)\\s*$`, 'i');
const OVERRIDE_ACTIONS = new Set(['relax', 'clarify', 'tighten']);

/** Core rules the baseline must always tag. Losing one is a FAIL. */
const REQUIRED_CORE_RULES = [
    'secrets.no-ask-user',
    'secrets.no-hardcode',
    'secrets.fetch-on-demand',
    'refusal.principle',
    'refusal.criteria-mandatory'
];

/**
 * Keyword heuristic for UNMARKED relaxations. A hit is only ever a WARN:
 * free-text detection has false positives and false negatives.
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

/** Keyword heuristic over lines that carry no override marker. */
function scanHeuristics(text) {
    const hits = [];
    String(text).split(/\r?\n/).forEach((line, index) => {
        if (/<!--\s*override:/.test(line)) {
            return;
        }
        for (const heuristic of HEURISTICS) {
            const match = line.match(heuristic.pattern);
            if (match && !NEGATION.test(match[0])) {
                hits.push({ rule: heuristic.rule, line: index + 1, excerpt: line.trim().slice(0, 160) });
                break;
            }
        }
    });
    return hits;
}

/** Strict calendar date: rejects 2026-02-30, which Date.parse would roll over. */
function isIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Parse a waivers file. Shape:
 *   { "waivers": [ { "rule", "reason", "owner", "expires"?, "layer"? } ] }
 * Returns { waivers, errors }. A waiver expires at the END of its expiry day (UTC).
 */
function parseWaivers(text, fileName) {
    const errors = [];
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        return { waivers: [], errors: [`${fileName}: invalid JSON (${error.message}).`] };
    }
    if (!data || !Array.isArray(data.waivers)) {
        return { waivers: [], errors: [`${fileName}: expected an object with a "waivers" array.`] };
    }
    const waivers = [];
    data.waivers.forEach((waiver, index) => {
        const where = `${fileName} waivers[${index}]`;
        const problems = [];
        for (const field of ['rule', 'reason', 'owner']) {
            if (typeof waiver?.[field] !== 'string' || waiver[field].trim() === '') {
                problems.push(`"${field}" is required`);
            }
        }
        if (waiver?.expires !== undefined && !isIsoDate(waiver.expires)) {
            problems.push('"expires" must be a YYYY-MM-DD date');
        }
        if (waiver?.layer !== undefined) {
            const layerError = typeof waiver.layer === 'string' && waiver.layer.trim() !== ''
                ? (waiver.layer.trim() === LOCAL_LAYER ? null : validateLayerPath(waiver.layer.trim()))
                : 'must be a non-empty path';
            if (layerError) {
                problems.push(`"layer" ${layerError}`);
            }
        }
        if (problems.length) {
            errors.push(`${where}: ${problems.join('; ')}.`);
            return;
        }
        waivers.push({
            rule: waiver.rule.trim(),
            reason: waiver.reason.trim(),
            owner: waiver.owner.trim(),
            expires: waiver.expires || null,
            layer: waiver.layer ? path.posix.normalize(waiver.layer.trim()) : null
        });
    });
    return { waivers, errors };
}

function waiverExpired(waiver, today) {
    return Boolean(waiver.expires) && waiver.expires < today;
}

function todayIso(now = new Date()) {
    return now.toISOString().slice(0, 10);
}

/**
 * Evaluate compliance for a checkout. Pure apart from file reads.
 * Returns { findings: [{ level, check, message, rule?, layer? }], waivers: [...] }.
 */
function evaluateLayerCompliance({ repoRoot, env = process.env, today = todayIso() }) {
    const findings = [];
    const add = (level, message, extra = {}) => findings.push({ level, check: 'layer-compliance', message, ...extra });

    // 1. Baseline rule IDs.
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

    // 2. Waivers (live file applies; the example is only validated).
    let waivers = [];
    for (const fileName of [WAIVERS_FILE, WAIVERS_EXAMPLE_FILE]) {
        const filePath = path.join(repoRoot, fileName);
        if (!fs.existsSync(filePath)) {
            continue;
        }
        const parsed = parseWaivers(fs.readFileSync(filePath, 'utf8'), fileName);
        for (const message of parsed.errors) {
            add('FAIL', message);
        }
        for (const waiver of parsed.waivers) {
            if (!rules.has(waiver.rule)) {
                add('WARN', `${fileName}: waiver for unknown rule ID "${waiver.rule}".`, { rule: waiver.rule });
            }
        }
        if (fileName === WAIVERS_FILE) {
            waivers = parsed.waivers.map((waiver) => ({
                ...waiver,
                status: waiverExpired(waiver, today) ? 'expired' : 'active',
                used: false
            }));
        }
    }

    // 3. Active layers: declared overrides + heuristic.
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
        const overrides = parseOverrides(text);
        const relaxed = new Set();
        for (const override of overrides) {
            const where = `${layer}:${override.line}`;
            if (override.malformed) {
                add('WARN', `${where}: malformed override marker "override:${override.raw}" (expected "<!-- override: <rule-id> relax|clarify|tighten -->").`, { layer });
                continue;
            }
            const rule = rules.get(override.rule);
            if (!OVERRIDE_ACTIONS.has(override.action)) {
                add('WARN', `${where}: override of "${override.rule}" uses unknown action "${override.action}" (use relax, clarify or tighten).`, { rule: override.rule, layer });
                continue;
            }
            if (!rule) {
                add('WARN', `${where}: override references unknown rule ID "${override.rule}".`, { rule: override.rule, layer });
                continue;
            }
            if (override.action !== 'relax') {
                add('PASS', `${where}: ${override.action}s ${rule.id} (no prohibition loosened).`, { rule: rule.id, layer });
                continue;
            }
            relaxed.add(rule.id);
            if (rule.tier === 'preference') {
                add('WARN', `${where}: relaxes preference rule ${rule.id}.`, { rule: rule.id, layer });
                continue;
            }
            const matching = waivers.filter((waiver) => waiver.rule === rule.id && (!waiver.layer || waiver.layer === layer));
            const active = matching.find((waiver) => waiver.status === 'active');
            if (active) {
                active.used = true;
                add('WARN', `${where}: relaxes core rule ${rule.id} under waiver (owner: ${active.owner}${active.expires ? `, expires ${active.expires}` : ''}).`, { rule: rule.id, layer, waived: true });
            } else {
                const expired = matching.find((waiver) => waiver.status === 'expired');
                add('FAIL', `${where}: relaxes core rule ${rule.id} without an active waiver`
                    + (expired ? ` (waiver expired ${expired.expires}).` : ` (add one to ${WAIVERS_FILE}).`), { rule: rule.id, layer });
            }
        }
        for (const hit of scanHeuristics(text)) {
            if (relaxed.has(hit.rule)) {
                continue;
            }
            add('WARN', `${layer}:${hit.line}: possible unmarked relaxation of ${hit.rule} (heuristic): "${hit.excerpt}". Mark it with an override marker or reword.`, { rule: hit.rule, layer, heuristic: true });
        }
    }

    // 4. Template: marker syntax only, never severity.
    const templatePath = path.join(repoRoot, EXAMPLE_LAYER);
    if (fs.existsSync(templatePath)) {
        for (const override of parseOverrides(fs.readFileSync(templatePath, 'utf8'))) {
            if (override.malformed || !OVERRIDE_ACTIONS.has(override.action) || !rules.has(override.rule)) {
                const shown = override.malformed ? override.raw : `${override.rule} ${override.action}`;
                add('FAIL', `${EXAMPLE_LAYER}:${override.line}: template override marker "${shown}" is invalid.`);
            }
        }
    }

    return { findings, waivers, layers };
}

/**
 * Shared PASS / WARN / FAIL report for scripts/audit-repo.js.
 * Exit codes: FAIL 1; WARN 0, or 2 with failOnWarn; PASS 0.
 */
function buildComplianceReport({ checkNames, findings, waivers = [], failOnWarn = false }) {
    const checks = checkNames.map((name) => {
        const own = findings.filter((finding) => finding.check === name);
        const level = own.some((finding) => finding.level === 'FAIL') ? 'FAIL'
            : own.some((finding) => finding.level === 'WARN') ? 'WARN' : 'PASS';
        return { name, level };
    });
    const counts = {
        fail: findings.filter((finding) => finding.level === 'FAIL').length,
        warn: findings.filter((finding) => finding.level === 'WARN').length,
        pass: checks.filter((check) => check.level === 'PASS').length
            + findings.filter((finding) => finding.level === 'PASS').length
    };
    const status = counts.fail ? 'FAIL' : counts.warn ? 'WARN' : 'PASS';
    const exitCode = status === 'FAIL' ? 1 : (status === 'WARN' && failOnWarn ? 2 : 0);
    return {
        status,
        summary: `Compliance: ${counts.fail} FAIL, ${counts.warn} WARN, ${counts.pass} PASS (status: ${status})`,
        counts,
        failOnWarn,
        exitCode,
        checks,
        findings,
        waivers
    };
}

module.exports = {
    buildComplianceReport,
    HEURISTICS,
    OVERRIDE_ACTIONS,
    REQUIRED_CORE_RULES,
    WAIVERS_EXAMPLE_FILE,
    WAIVERS_FILE,
    evaluateLayerCompliance,
    parseBaselineRules,
    parseOverrides,
    parseWaivers,
    scanHeuristics,
    todayIso
};
