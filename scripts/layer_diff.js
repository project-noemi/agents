'use strict';

/**
 * Layer difference report (docs/configuration-layers.md).
 *
 * Later layers win on conflict. This reporter names which tagged rule a later
 * layer overrode (`relax` / `clarify` / `tighten`) and a consequence class
 * (credentials-in-repo, identity, spend, style). Classes are descriptive
 * labels. Default exit 0. The deploying organization's appetite file is where
 * "is this acceptable" lives; `--fail-on-appetite` is opt-in.
 */

const fs = require('fs');
const path = require('path');
const { EXAMPLE_LAYER, LOCAL_LAYER, resolveLayers } = require('./context_layers');

const RULE_ID = '[a-z0-9]+(?:[.-][a-z0-9]+)+';
const RULE_MARKER = new RegExp(`<!--\\s*rule:\\s*(${RULE_ID})\\s*(?:\\((core|preference)\\))?\\s*-->`, 'g');
const OVERRIDE_COMMENT = /<!--\s*override:([\s\S]*?)-->/g;
const OVERRIDE_BODY = new RegExp(`^\\s*(${RULE_ID})\\s+([a-z]+)\\s*$`, 'i');
const OVERRIDE_ACTIONS = new Set(['relax', 'clarify', 'tighten']);
const APPETITE_EXAMPLE = 'AGENTS.appetite.example.json';
const APPETITE_DEFAULT = 'AGENTS.appetite.json';
const APPETITE_ENV = 'NOEMI_APPETITE';

const RULE_CATALOG = {
    'secrets.no-ask-user': { class: 'credentials-in-repo' },
    'secrets.no-hardcode': { class: 'credentials-in-repo' },
    'secrets.fetch-on-demand': { class: 'credentials-in-repo' },
    'refusal.principle': { class: 'identity' },
    'refusal.criteria-mandatory': { class: 'identity' },
    'coding.branch-naming': { class: 'style' },
    'coding.model-baseline': { class: 'spend' },
    'coding.naming-conventions': { class: 'style' }
};

function consequenceClass(ruleId) {
    if (RULE_CATALOG[ruleId]) {
        return RULE_CATALOG[ruleId].class;
    }
    if (String(ruleId).startsWith('secrets.')) {
        return 'credentials-in-repo';
    }
    if (String(ruleId).startsWith('refusal.')) {
        return 'identity';
    }
    return 'unclassified';
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
 * Parse override markers from a layer. Returns [{ rule, action, line, excerpt }]
 * or { malformed, raw, line, excerpt }.
 */
function parseOverrides(text) {
    const overrides = [];
    String(text).split(/\r?\n/).forEach((line, index) => {
        for (const match of line.matchAll(OVERRIDE_COMMENT)) {
            const body = match[1];
            const excerpt = line.replace(OVERRIDE_COMMENT, ' ').trim().slice(0, 160);
            const parsed = body.match(OVERRIDE_BODY);
            if (parsed) {
                overrides.push({
                    rule: parsed[1],
                    action: parsed[2].toLowerCase(),
                    line: index + 1,
                    excerpt
                });
            } else {
                overrides.push({ malformed: true, raw: body.trim(), line: index + 1, excerpt });
            }
        }
    });
    return overrides;
}

/** Repo-invariant: the published baseline tags every catalogued ID. */
function auditRuleCatalog(repoRoot) {
    const failures = [];
    const agentsMdPath = path.join(repoRoot, 'AGENTS.md');
    if (!fs.existsSync(agentsMdPath)) {
        return ['AGENTS.md is missing.'];
    }
    const { rules, errors } = parseBaselineRules(fs.readFileSync(agentsMdPath, 'utf8'));
    failures.push(...errors);
    for (const id of Object.keys(RULE_CATALOG)) {
        if (!rules.has(id)) {
            failures.push(`AGENTS.md is missing the stable rule ID marker "<!-- rule: ${id} -->".`);
        }
    }
    return failures;
}

function loadAppetite(filePath) {
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new Error(`appetite file is not valid JSON: ${error.message}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('appetite file must be a JSON object');
    }
    if (parsed.version !== 1) {
        throw new Error('appetite file must set "version": 1');
    }
    if (!Array.isArray(parsed.failOn)) {
        throw new Error('appetite file must include a "failOn" array');
    }
    for (const [index, spec] of parsed.failOn.entries()) {
        if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error(`failOn[${index}] must be an object`);
        }
        if (!spec.rule && !spec.class) {
            throw new Error(`failOn[${index}] must name a "rule" or a "class"`);
        }
        if (spec.action && !OVERRIDE_ACTIONS.has(spec.action) && spec.action !== 'malformed') {
            throw new Error(`failOn[${index}] has unknown action "${spec.action}"`);
        }
    }
    if (parsed.attestations !== undefined && !Array.isArray(parsed.attestations)) {
        throw new Error('appetite file "attestations" must be an array when present');
    }
    return parsed;
}

function auditAppetiteExample(repoRoot) {
    const examplePath = path.join(repoRoot, APPETITE_EXAMPLE);
    if (!fs.existsSync(examplePath)) {
        return [`${APPETITE_EXAMPLE} (the copyable appetite profile) is missing.`];
    }
    try {
        loadAppetite(examplePath);
        return [];
    } catch (error) {
        return [`${APPETITE_EXAMPLE}: ${error.message}`];
    }
}

function differenceMatchesFailOn(diff, spec) {
    if (spec.rule && spec.rule !== diff.rule) {
        return false;
    }
    if (spec.class && spec.class !== diff.class) {
        return false;
    }
    if (spec.action && spec.action !== diff.action) {
        return false;
    }
    return true;
}

/**
 * Evaluate tagged overrides for a checkout. Pure apart from file reads.
 * Returns { layers, differences, malformed, catalogErrors, resolveErrors }.
 */
function evaluateLayerDiff({ repoRoot, env = process.env } = {}) {
    const catalogErrors = auditRuleCatalog(repoRoot);
    const malformed = [];
    const differences = [];

    let resolved;
    try {
        resolved = resolveLayers({ repoRoot, env });
    } catch (error) {
        return {
            layers: [],
            differences: [],
            malformed: [],
            catalogErrors,
            resolveErrors: [error.message]
        };
    }

    const resolveErrors = resolved.errors.map((item) => {
        const source = resolved.source || 'layers';
        return `${source}:${item.line}: ${item.path} — ${item.error}`;
    });

    const layers = resolveErrors.length ? [] : [...resolved.present];
    if (!resolveErrors.length && resolved.local) {
        layers.push(LOCAL_LAYER);
    }

    if (resolveErrors.length === 0) {
        for (const layer of layers) {
            const text = fs.readFileSync(path.join(repoRoot, layer), 'utf8');
            for (const override of parseOverrides(text)) {
                const where = `${layer}:${override.line}`;
                if (override.malformed) {
                    malformed.push({
                        layer,
                        line: override.line,
                        where,
                        raw: override.raw,
                        excerpt: override.excerpt
                    });
                    continue;
                }
                differences.push({
                    layer,
                    line: override.line,
                    where,
                    rule: override.rule,
                    action: override.action,
                    class: consequenceClass(override.rule),
                    knownAction: OVERRIDE_ACTIONS.has(override.action),
                    excerpt: override.excerpt,
                    wins: false
                });
            }
        }
    }

    const lastByRule = new Map();
    for (const diff of differences) {
        lastByRule.set(diff.rule, diff);
    }
    for (const diff of lastByRule.values()) {
        diff.wins = true;
    }

    return { layers, differences, malformed, catalogErrors, resolveErrors };
}

function resolveAppetitePath({ repoRoot, env = process.env, appetitePath = null } = {}) {
    if (appetitePath) {
        return path.isAbsolute(appetitePath) ? appetitePath : path.join(repoRoot, appetitePath);
    }
    if (typeof env[APPETITE_ENV] === 'string' && env[APPETITE_ENV].trim()) {
        const fromEnv = env[APPETITE_ENV].trim();
        return path.isAbsolute(fromEnv) ? fromEnv : path.join(repoRoot, fromEnv);
    }
    const defaultPath = path.join(repoRoot, APPETITE_DEFAULT);
    if (fs.existsSync(defaultPath)) {
        return defaultPath;
    }
    return null;
}

function applyAppetite(evaluation, appetite, appetitePath) {
    const winning = evaluation.differences.filter((diff) => diff.wins);
    const matches = [];
    for (const spec of appetite.failOn) {
        for (const diff of winning) {
            if (differenceMatchesFailOn(diff, spec)) {
                matches.push({ ...diff, matchedBy: spec });
            }
        }
    }
    const attestations = Array.isArray(appetite.attestations)
        ? appetite.attestations.filter((entry) => {
            if (!entry || typeof entry !== 'object') {
                return false;
            }
            return evaluation.differences.some((diff) => (
                (!entry.rule || entry.rule === diff.rule)
                && (!entry.action || entry.action === diff.action)
            ));
        })
        : [];
    return {
        path: appetitePath,
        owner: appetite.owner || null,
        description: appetite.description || null,
        matches,
        attestations
    };
}

function formatReport(evaluation, appetiteResult, { failOnAppetite = false } = {}) {
    const lines = [];
    lines.push('Layer difference report');
    const stack = evaluation.layers.length
        ? ['AGENTS.md', ...evaluation.layers].join(' -> ')
        : 'AGENTS.md (baseline only)';
    lines.push(`Load order: ${stack}`);
    lines.push('Later sources win. Consequence classes are descriptive labels.');
    lines.push('');

    if (evaluation.resolveErrors.length) {
        lines.push('Resolve errors:');
        for (const message of evaluation.resolveErrors) {
            lines.push(`  ${message}`);
        }
        lines.push('');
    }

    if (evaluation.catalogErrors.length) {
        lines.push('Baseline catalog:');
        for (const message of evaluation.catalogErrors) {
            lines.push(`  ${message}`);
        }
        lines.push('');
    }

    if (evaluation.differences.length === 0) {
        lines.push('No tagged overrides in the active layers.');
    } else {
        lines.push('Tagged overrides:');
        for (const diff of evaluation.differences) {
            const win = diff.wins ? 'wins' : 'superseded';
            const actionNote = diff.knownAction ? diff.action : `${diff.action} (unknown action)`;
            lines.push(`  ${diff.where}  ${diff.rule}  ${actionNote}  ${diff.class}  (${win})`);
        }
    }

    if (evaluation.malformed.length) {
        lines.push('');
        lines.push('Malformed override markers:');
        for (const item of evaluation.malformed) {
            lines.push(`  ${item.where}  override:${item.raw}`);
        }
    }

    if (appetiteResult) {
        lines.push('');
        lines.push(`Appetite: ${appetiteResult.path}`);
        if (appetiteResult.owner) {
            lines.push(`  owner: ${appetiteResult.owner}`);
        }
        if (appetiteResult.matches.length === 0) {
            lines.push('  No winning override matches this appetite.');
        } else {
            for (const match of appetiteResult.matches) {
                lines.push(`  MATCH  ${match.where}  ${match.rule} ${match.action}  (${match.class})`);
            }
        }
        if (appetiteResult.attestations.length) {
            lines.push('Attestations (log only; they do not change the exit code):');
            for (const entry of appetiteResult.attestations) {
                const bits = [
                    entry.rule || '(any rule)',
                    entry.action || '(any action)',
                    entry.owner ? `owner=${entry.owner}` : null,
                    entry['review-by'] ? `review-by=${entry['review-by']}` : null
                ].filter(Boolean);
                lines.push(`  ${bits.join('  ')}`);
                if (entry.reason) {
                    lines.push(`    reason: ${entry.reason}`);
                }
            }
        }
    } else {
        lines.push('');
        lines.push(`Appetite: not applied (copy ${APPETITE_EXAMPLE} and pass --fail-on-appetite).`);
    }

    lines.push('');
    if (failOnAppetite) {
        lines.push(appetiteResult && appetiteResult.matches.length
            ? 'Exit 1: winning overrides match this organization\'s appetite.'
            : 'Exit 0: no winning override matches this organization\'s appetite.');
    } else {
        lines.push('Exit 0 (default). Pass --fail-on-appetite to exit 1 on appetite matches.');
    }
    return `${lines.join('\n')}\n`;
}

function parseCliArgs(argv) {
    let failOnAppetite = false;
    let appetitePath = null;
    let json = false;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--fail-on-appetite') {
            failOnAppetite = true;
        } else if (arg === '--json') {
            json = true;
        } else if (arg.startsWith('--appetite=')) {
            appetitePath = arg.slice('--appetite='.length);
        } else if (arg === '--appetite') {
            appetitePath = argv[index + 1] || null;
            index += 1;
        } else if (arg === '--help' || arg === '-h') {
            return { help: true };
        } else {
            return { error: `unknown argument: ${arg}` };
        }
    }
    return { failOnAppetite, appetitePath, json };
}

function runCli({
    repoRoot,
    env = process.env,
    argv = process.argv.slice(2),
    stdout = process.stdout,
    stderr = process.stderr
} = {}) {
    const args = parseCliArgs(argv);
    if (args.help) {
        stdout.write(`Usage: node scripts/layer_diff.js [--json] [--appetite <path>] [--fail-on-appetite]

Reports tagged AGENTS.md layer overrides. Default exit 0.
--fail-on-appetite exits 1 when a winning override matches the appetite file.
Appetite path: --appetite, else ${APPETITE_ENV}, else ${APPETITE_DEFAULT} if present.
`);
        return 0;
    }
    if (args.error) {
        stderr.write(`${args.error}\n`);
        return 2;
    }

    const evaluation = evaluateLayerDiff({ repoRoot, env });
    if (evaluation.resolveErrors.length) {
        stderr.write(`${evaluation.resolveErrors.join('\n')}\n`);
        if (!args.json) {
            stdout.write(formatReport(evaluation, null, { failOnAppetite: args.failOnAppetite }));
        } else {
            stdout.write(`${JSON.stringify({ evaluation, appetite: null }, null, 2)}\n`);
        }
        return 2;
    }

    let appetiteResult = null;
    const resolvedAppetite = resolveAppetitePath({
        repoRoot,
        env,
        appetitePath: args.appetitePath
    });
    if (args.failOnAppetite && !resolvedAppetite) {
        stderr.write(`No appetite file found. Copy ${APPETITE_EXAMPLE} to ${APPETITE_DEFAULT}, or pass --appetite / ${APPETITE_ENV}.\n`);
        return 2;
    }
    if (resolvedAppetite) {
        try {
            const appetite = loadAppetite(resolvedAppetite);
            appetiteResult = applyAppetite(evaluation, appetite, path.relative(repoRoot, resolvedAppetite) || resolvedAppetite);
        } catch (error) {
            stderr.write(`${resolvedAppetite}: ${error.message}\n`);
            return 2;
        }
    }

    if (args.json) {
        stdout.write(`${JSON.stringify({ evaluation, appetite: appetiteResult }, null, 2)}\n`);
    } else {
        stdout.write(formatReport(evaluation, appetiteResult, { failOnAppetite: args.failOnAppetite }));
    }

    if (args.failOnAppetite && appetiteResult && appetiteResult.matches.length) {
        return 1;
    }
    return 0;
}

if (require.main === module) {
    const repoRoot = path.join(__dirname, '..');
    process.exit(runCli({ repoRoot, env: process.env, argv: process.argv.slice(2) }));
}

module.exports = {
    APPETITE_DEFAULT,
    APPETITE_ENV,
    APPETITE_EXAMPLE,
    EXAMPLE_LAYER,
    OVERRIDE_ACTIONS,
    RULE_CATALOG,
    applyAppetite,
    auditAppetiteExample,
    auditRuleCatalog,
    consequenceClass,
    evaluateLayerDiff,
    formatReport,
    loadAppetite,
    parseBaselineRules,
    parseCliArgs,
    parseOverrides,
    resolveAppetitePath,
    runCli
};
