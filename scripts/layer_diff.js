'use strict';

/**
 * Preference-rule override report (docs/configuration-layers.md § Preference
 * overrides and appetite).
 *
 * Scope is preference rules only. Core rules (secrets.*, refusal.*) are
 * enforced by scripts/layer_compliance.js in `npm run audit`, which FAILs any
 * attempt to relax one; this script does not read, score, or waive them.
 *
 * What this adds over layer_compliance.js:
 *   - Resolution: when several layers override the same preference rule, it
 *     names the override that wins (the last one in load order) and marks the
 *     earlier ones superseded. The audit scores each marker on its own.
 *   - An opt-in bar: an organization lists preference-rule overrides it will
 *     not accept in an appetite file, and `--fail-on-appetite` exits 1 when a
 *     winning override matches. The audit only WARNs on a preference relax.
 *
 * Default exit 0. Exit 1 only with --fail-on-appetite and a match. Exit 2 on
 * a usage, manifest, or appetite-file error.
 */

const fs = require('fs');
const path = require('path');
const { LOCAL_LAYER, resolveLayers } = require('./context_layers');
const { OVERRIDE_ACTIONS, isCoreRuleId, parseBaselineRules, parseOverrides } = require('./layer_compliance');

const APPETITE_DEFAULT = 'AGENTS.appetite.json';
const APPETITE_EXAMPLE = 'AGENTS.appetite.example.json';

function preferenceRules(repoRoot) {
    const { rules } = parseBaselineRules(fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8'));
    const ids = new Set();
    for (const rule of rules.values()) {
        if (rule.tier === 'preference' && !isCoreRuleId(rule.id)) {
            ids.add(rule.id);
        }
    }
    return ids;
}

/**
 * Overrides of preference rules in the active layers, in load order, with the
 * winning override per rule marked. Returns { layers, overrides, errors }.
 */
function evaluatePreferenceOverrides({ repoRoot, env = process.env } = {}) {
    let resolved;
    try {
        resolved = resolveLayers({ repoRoot, env });
    } catch (error) {
        return { layers: [], overrides: [], errors: [error.message] };
    }
    if (resolved.errors.length) {
        const source = resolved.source || 'layers';
        return {
            layers: [],
            overrides: [],
            errors: resolved.errors.map((item) => `${source}:${item.line}: ${item.path} — ${item.error}`)
        };
    }

    const preference = preferenceRules(repoRoot);
    const layers = [...resolved.present, ...(resolved.local ? [LOCAL_LAYER] : [])];
    const overrides = [];
    for (const layer of layers) {
        const text = fs.readFileSync(path.join(repoRoot, layer), 'utf8');
        for (const override of parseOverrides(text)) {
            // Malformed markers, unknown IDs, unknown actions and core rules
            // are scored by layer_compliance.js; this report skips them.
            if (override.malformed || !preference.has(override.rule) || !OVERRIDE_ACTIONS.has(override.action)) {
                continue;
            }
            overrides.push({
                layer,
                line: override.line,
                where: `${layer}:${override.line}`,
                rule: override.rule,
                action: override.action,
                wins: false,
                supersededBy: null
            });
        }
    }
    const last = new Map();
    for (const item of overrides) {
        last.set(item.rule, item);
    }
    for (const item of overrides) {
        const winner = last.get(item.rule);
        item.wins = winner === item;
        item.supersededBy = item.wins ? null : winner.where;
    }
    return { layers, overrides, errors: [] };
}

/** Load and validate an appetite file against the baseline's preference rules. */
function loadAppetite(filePath, repoRoot) {
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new Error(`appetite file is not valid JSON: ${error.message}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== 1) {
        throw new Error('appetite file must be a JSON object with "version": 1');
    }
    if (!Array.isArray(parsed.failOn)) {
        throw new Error('appetite file must include a "failOn" array');
    }
    const preference = preferenceRules(repoRoot);
    parsed.failOn.forEach((spec, index) => {
        if (!spec || typeof spec !== 'object' || typeof spec.rule !== 'string') {
            throw new Error(`failOn[${index}] must be an object with a "rule"`);
        }
        if (isCoreRuleId(spec.rule)) {
            throw new Error(`failOn[${index}]: "${spec.rule}" is a core rule. Core rules are enforced by \`npm run audit\` (scripts/layer_compliance.js); the appetite file covers preference rules only.`);
        }
        if (!preference.has(spec.rule)) {
            throw new Error(`failOn[${index}]: "${spec.rule}" is not a preference rule tagged in AGENTS.md`);
        }
        if (spec.action !== undefined && !OVERRIDE_ACTIONS.has(spec.action)) {
            throw new Error(`failOn[${index}] has unknown action "${spec.action}"`);
        }
    });
    return parsed;
}

/** Winning overrides that match an appetite failOn entry. */
function matchAppetite(evaluation, appetite) {
    return evaluation.overrides.filter((item) => item.wins && appetite.failOn.some((spec) => (
        spec.rule === item.rule && (spec.action === undefined || spec.action === item.action)
    )));
}

function formatReport(evaluation, appetite) {
    const lines = ['Preference-rule overrides'];
    lines.push(`Load order: ${['AGENTS.md', ...evaluation.layers].join(' -> ')}`);
    lines.push('Core rules (secrets.*, refusal.*) are not covered here; `npm run audit` (scripts/layer_compliance.js) enforces them.');
    lines.push('');
    if (evaluation.overrides.length === 0) {
        lines.push('No preference-rule overrides in the active layers.');
    }
    for (const item of evaluation.overrides) {
        const state = item.wins ? 'wins' : `superseded by ${item.supersededBy}`;
        lines.push(`  ${item.where}  ${item.rule}  ${item.action}  (${state})`);
    }
    if (appetite) {
        lines.push('');
        lines.push(`Appetite: ${appetite.path}`);
        if (appetite.matches.length === 0) {
            lines.push('  No winning override matches failOn.');
        }
        for (const item of appetite.matches) {
            lines.push(`  MATCH  ${item.where}  ${item.rule} ${item.action}`);
        }
    }
    return `${lines.join('\n')}\n`;
}

function parseCliArgs(argv) {
    const args = { failOnAppetite: false, appetitePath: null };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--fail-on-appetite') {
            args.failOnAppetite = true;
        } else if (arg.startsWith('--appetite=')) {
            args.appetitePath = arg.slice('--appetite='.length);
        } else if (arg === '--appetite' && argv[index + 1]) {
            args.appetitePath = argv[index + 1];
            index += 1;
        } else if (arg === '--help' || arg === '-h') {
            return { help: true };
        } else {
            return { error: `unknown argument: ${arg}` };
        }
    }
    return args;
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
        stdout.write(`Usage: node scripts/layer_diff.js [--appetite <path>] [--fail-on-appetite]

Lists preference-rule overrides in the active layers and which one wins. Default exit 0.
--fail-on-appetite exits 1 when a winning override matches the appetite file's failOn list.
Appetite path: --appetite, else ${APPETITE_DEFAULT} if present. Template: ${APPETITE_EXAMPLE}.
Core rules are enforced by npm run audit, not by this script.
`);
        return 0;
    }
    if (args.error) {
        stderr.write(`${args.error}\n`);
        return 2;
    }

    const evaluation = evaluatePreferenceOverrides({ repoRoot, env });
    if (evaluation.errors.length) {
        stderr.write(`${evaluation.errors.join('\n')}\n`);
        return 2;
    }

    let appetitePath = null;
    if (args.appetitePath) {
        appetitePath = path.isAbsolute(args.appetitePath) ? args.appetitePath : path.join(repoRoot, args.appetitePath);
    } else if (fs.existsSync(path.join(repoRoot, APPETITE_DEFAULT))) {
        appetitePath = path.join(repoRoot, APPETITE_DEFAULT);
    }
    if (args.failOnAppetite && !appetitePath) {
        stderr.write(`No appetite file found. Copy ${APPETITE_EXAMPLE} to ${APPETITE_DEFAULT}, or pass --appetite <path>.\n`);
        return 2;
    }

    let appetite = null;
    if (appetitePath) {
        try {
            const loaded = loadAppetite(appetitePath, repoRoot);
            appetite = {
                path: path.relative(repoRoot, appetitePath) || appetitePath,
                matches: matchAppetite(evaluation, loaded)
            };
        } catch (error) {
            stderr.write(`${appetitePath}: ${error.message}\n`);
            return 2;
        }
    }

    stdout.write(formatReport(evaluation, appetite));
    return args.failOnAppetite && appetite.matches.length ? 1 : 0;
}

if (require.main === module) {
    process.exit(runCli({ repoRoot: path.join(__dirname, '..') }));
}

module.exports = {
    APPETITE_DEFAULT,
    APPETITE_EXAMPLE,
    evaluatePreferenceOverrides,
    formatReport,
    loadAppetite,
    matchAppetite,
    parseCliArgs,
    preferenceRules,
    runCli
};
