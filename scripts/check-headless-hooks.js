#!/usr/bin/env node

// Headless readiness gate (Decision [2026-09-27-0001]).
// Headless runs must not execute hooks that wait for a person. A desktop
// dictation Stop hook stalled a Grok run for ten minutes that way. Profile
// isolation is the fix, and this gate refuses to dispatch without it:
// GROK_HOME has to be a loop-owned directory (not the interactive ~/.grok)
// whose requirements.toml or managed_config.toml engages allow_managed_hooks_only,
// and that pin has to survive session start (fail_closed = true in requirements.toml).
// Exit codes: 0 ready, 1 not ready, 2 usage error, 3 read fault on a policy file.
// Claude Code has to be --bare or carry disableAllHooks. File contents stay off stdout.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const PROFILE_FILES = ['requirements.toml', 'config.toml', 'managed_config.toml'];
const SAFE_HOOK_KEY = /^[A-Za-z0-9_]{1,40}$/;
const MISSING_PIN = 'allow_managed_hooks_only = true is missing from requirements.toml and managed_config.toml';
const MISSING_FAIL_CLOSED = 'fail_closed = true is missing; grok removes an unsigned requirements.toml at session start, so the pin would not survive the first run';

// An unquoted # starts a TOML comment even when it is glued to the value
// (`true#pin`). Quotes still hide a hash. A """ or ''' that does not close
// on this line owns every following line until it does, so a multi-line
// string cannot smuggle a pin or a hook table.
function scanCode(line, openDelim) {
    let i = 0;
    if (openDelim) {
        const closeAt = line.indexOf(openDelim);
        if (closeAt === -1) return { line: '', openDelim, skip: true };
        i = closeAt + openDelim.length;
        openDelim = null;
    }

    let out = '';
    let quote = null;
    for (; i < line.length; i += 1) {
        const ch = line[i];
        if (quote) {
            out += ch;
            if (quote === '"' && ch === '\\') {
                i += 1;
                if (i < line.length) out += line[i];
                continue;
            }
            if (ch === quote) quote = null;
            continue;
        }
        if ((ch === '"' || ch === '\'') && line.startsWith(ch + ch + ch, i)) {
            const delim = ch + ch + ch;
            const closeAt = line.indexOf(delim, i + 3);
            if (closeAt === -1) return { line: '', openDelim: delim, skip: true };
            out += line.slice(i, closeAt + 3);
            i = closeAt + 2;
            continue;
        }
        if (ch === '"' || ch === '\'') {
            quote = ch;
            out += ch;
            continue;
        }
        if (ch === '#') break;
        out += ch;
    }
    return { line: out.trim(), openDelim: null, skip: false };
}

function normalizeSection(raw) {
    return raw.trim().replace(/\s*\.\s*/g, '.').replace(/\s+/g, '');
}

function hookEventFromHeader(line) {
    const match = line.match(/^\[\[\s*hooks\s*\.\s*(?:"([^"]*)"|'([^']*)'|([A-Za-z0-9_]+))\s*\]\]$/);
    if (!match) return null;
    const event = match[1] || match[2] || match[3];
    return event || null;
}

function hookEventFromHooksTable(line) {
    const match = line.match(/^(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_]+))\s*=\s*\[/);
    if (!match) return null;
    return match[1] || match[2] || match[3] || null;
}

function emptyHookState() {
    return {
        allowManagedHooksOnly: null,
        hookTables: [],
        compat: { claude: null, cursor: null },
        failClosed: null,
    };
}

// Line-oriented on purpose: the profile files are small, and the keys that
// decide dispatch are assignments and table headers.
function parseTomlHookState(tomlText) {
    const state = emptyHookState();
    if (typeof tomlText !== 'string' || tomlText === '') return state;

    let section = '';
    let openDelim = null;
    const text = tomlText.replace(/^\uFEFF/, '');
    for (const rawLine of text.split(/\r?\n/)) {
        const scanned = scanCode(openDelim ? rawLine : rawLine.trim(), openDelim);
        openDelim = scanned.openDelim;
        if (scanned.skip || scanned.line === '') continue;
        const line = scanned.line;

        const arrayEvent = hookEventFromHeader(line);
        if (arrayEvent) {
            state.hookTables.push(arrayEvent);
            // The header is the current table. A pin on the next line is not top-level.
            section = `hooks.${arrayEvent}`;
            continue;
        }

        const header = line.match(/^\[([^[\]]+)\]$/);
        if (header) {
            section = normalizeSection(header[1]);
            continue;
        }

        if (section === 'hooks') {
            const tableEvent = hookEventFromHooksTable(line);
            if (tableEvent) {
                state.hookTables.push(tableEvent);
                continue;
            }
        }

        const assignment = line.match(/^([A-Za-z0-9_.]+)\s*=\s*(.*)$/);
        if (!assignment) continue;
        const key = assignment[1];
        const value = assignment[2].trim();
        if (value === '') continue;

        // Grok reads the pin and fail_closed only as top-level keys. Any value
        // other than the boolean false engages the pin.
        if (section === '' && (key === 'allow_managed_hooks_only' || key === 'allowManagedHooksOnly')) {
            state.allowManagedHooksOnly = value !== 'false';
            continue;
        }
        if (section === '' && key === 'fail_closed') {
            if (value === 'true') state.failClosed = true;
            else if (value === 'false') state.failClosed = false;
            continue;
        }

        const full = section ? `${section}.${key}` : key;
        if (full === 'compat.claude.hooks' || full === 'compat.cursor.hooks') {
            if (value === 'true' || value === 'false') {
                state.compat[full.split('.')[1]] = value === 'true';
            }
        }
    }
    return state;
}

function finding(severity, source, message) {
    return { severity, source, message };
}

function canonicalHome(dir) {
    if (typeof dir !== 'string' || dir === '') return '';
    const resolved = path.resolve(dir);
    try {
        // realpath catches a symlink to the interactive home, and on a
        // case-insensitive volume a differently-cased spelling of it.
        return fs.realpathSync.native(resolved);
    } catch (err) {
        return resolved;
    }
}

function sameDirectory(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') return false;
    return canonicalHome(left) === canonicalHome(right);
}

function pinEngaged(state) {
    return !!(state && state.allowManagedHooksOnly === true);
}

function evaluateGrokHome({
    home,
    defaultHome,
    requirements,
    config,
    managedConfig,
}) {
    const findings = [];

    if (sameDirectory(home, defaultHome)) {
        findings.push(finding(
            'block',
            'GROK_HOME',
            'the run would use the interactive profile'
        ));
    }

    const requirementsState = typeof requirements === 'string' ? parseTomlHookState(requirements) : null;
    const managedState = typeof managedConfig === 'string' ? parseTomlHookState(managedConfig) : null;
    // config.toml is the user's file. A pin there does not count.
    const engaged = pinEngaged(requirementsState) || pinEngaged(managedState);
    if (!engaged) {
        findings.push(finding('block', 'requirements.toml', MISSING_PIN));
    } else if (!(requirementsState && requirementsState.failClosed === true)) {
        // grok 1.0.41 deletes an unsigned requirements.toml and managed_config.toml
        // at session start. fail_closed keeps the requirements file. The
        // undocumented GROK_MANAGED_CONFIG=false also does, but the gate does not
        // accept it: the profile must stand on documented keys alone.
        findings.push(finding('block', 'requirements.toml', MISSING_FAIL_CLOSED));
    }

    const configState = typeof config === 'string' ? parseTomlHookState(config) : null;
    const compat = configState ? configState.compat : { claude: null, cursor: null };
    if (configState && configState.hookTables.length > 0) {
        findings.push(finding(
            'warn',
            'config.toml',
            `hook tables ${configState.hookTables.join(', ')} are skipped by the pin, but the profile is contaminated`
        ));
    }
    for (const vendor of ['claude', 'cursor']) {
        if (compat[vendor] !== false) {
            findings.push(finding(
                'warn',
                'config.toml',
                `${vendor} hook import is not switched off ([compat.${vendor}] hooks = false)`
            ));
        }
    }

    if (managedState && managedState.hookTables.length > 0) {
        findings.push(finding(
            'warn',
            'managed_config.toml',
            `hook tables ${managedState.hookTables.join(', ')} in managed_config.toml are skipped by the pin; only root-owned /etc/grok files or a signed requirements.toml can enforce hooks`
        ));
    }

    if (findings.length === 0) {
        findings.push(finding('info', 'GROK_HOME', 'profile is isolated'));
    }
    return { findings };
}

function describeHookKeys(hooks) {
    const safe = [];
    let unrecognized = 0;
    for (const key of Object.keys(hooks)) {
        if (SAFE_HOOK_KEY.test(key)) safe.push(key);
        else unrecognized += 1;
    }
    const parts = [];
    if (safe.length > 0) parts.push(`hook events ${safe.join(', ')} are enabled`);
    if (unrecognized > 0) parts.push(`${unrecognized} unrecognized key(s)`);
    return parts.join('; ');
}

function evaluateClaudeSettings({ settingsText, bare }) {
    if (bare === true) {
        return { findings: [finding('info', 'claude', 'bare mode skips hooks')] };
    }
    if (settingsText == null) {
        return { findings: [finding('block', 'claude-settings', 'no Claude settings provided')] };
    }

    let parsed;
    try {
        parsed = JSON.parse(String(settingsText).replace(/^\uFEFF/, ''));
    } catch (err) {
        // The parser's own message quotes the input. A fixed sentence does not.
        return { findings: [finding('block', 'claude-settings', 'Claude settings are invalid JSON')] };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { findings: [finding('block', 'claude-settings', 'Claude settings are not a JSON object')] };
    }
    if (parsed.disableAllHooks === true) {
        return { findings: [finding('info', 'claude-settings', 'disableAllHooks is true')] };
    }
    if (parsed.hooks && typeof parsed.hooks === 'object' && !Array.isArray(parsed.hooks)) {
        const names = describeHookKeys(parsed.hooks);
        if (names) {
            return { findings: [finding('block', 'claude-settings', names)] };
        }
    }
    // No hooks and no flag is a warning: the file may be project-level, and
    // those hooks are the loop's own. User-level hooks still need a real off switch.
    return {
        findings: [finding(
            'warn',
            'claude-settings',
            'user-level hooks are not disabled; pass --bare or disableAllHooks'
        )],
    };
}

function summarize(findings) {
    const summary = { ready: true, blocks: 0, warns: 0, infos: 0 };
    for (const item of findings || []) {
        if (!item) continue;
        if (item.severity === 'block') summary.blocks += 1;
        else if (item.severity === 'warn') summary.warns += 1;
        else if (item.severity === 'info') summary.infos += 1;
    }
    summary.ready = summary.blocks === 0;
    return summary;
}

// A missing profile file is an absent pin or an absent settings document.
// Permission errors and "this path is a directory" are faults, not absence.
function readTextIfExists(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        if (err && err.code === 'ENOENT') return null;
        if (err && err.path == null) err.path = filePath;
        throw err;
    }
}

function interactiveGrokHome() {
    return path.join(os.homedir(), '.grok');
}

function runCheck(options = {}) {
    const readFile = typeof options.readFile === 'function' ? options.readFile : readTextIfExists;
    const grokHome = path.resolve(options.grokHome || process.env.GROK_HOME || interactiveGrokHome());
    const defaultGrokHome = path.resolve(options.defaultGrokHome || interactiveGrokHome());
    const claudeBare = options.claudeBare === true;
    const claudeSettingsPath = options.claudeSettingsPath || null;

    const texts = {};
    for (const name of PROFILE_FILES) {
        texts[name] = readFile(path.join(grokHome, name));
    }

    const findings = evaluateGrokHome({
        home: grokHome,
        defaultHome: defaultGrokHome,
        requirements: texts['requirements.toml'],
        config: texts['config.toml'],
        managedConfig: texts['managed_config.toml'],
    }).findings;

    if (claudeBare) {
        // --bare is sufficient. The settings file is not consulted, so a
        // hooks map sitting next to the flag cannot change the verdict.
        findings.push(...evaluateClaudeSettings({ settingsText: null, bare: true }).findings);
    } else if (claudeSettingsPath) {
        findings.push(...evaluateClaudeSettings({
            settingsText: readFile(claudeSettingsPath),
            bare: false,
        }).findings);
    } else {
        findings.push(finding(
            'info',
            'claude',
            'Claude evaluation skipped; pass --claude-settings or --claude-bare'
        ));
    }

    const summary = summarize(findings);
    return {
        ready: summary.ready,
        summary,
        findings,
        inputs: { grokHome, claudeSettingsPath, claudeBare },
    };
}

function usageLine() {
    return 'usage: node scripts/check-headless-hooks.js [--grok-home <dir>] [--claude-settings <file>] [--claude-bare] [--json] [--help]';
}

function parseCliArgs(argv) {
    const parsed = {
        grokHome: null,
        claudeSettingsPath: null,
        claudeBare: false,
        json: false,
        help: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            parsed.help = true;
            continue;
        }
        if (arg === '--json') {
            parsed.json = true;
            continue;
        }
        if (arg === '--claude-bare') {
            parsed.claudeBare = true;
            continue;
        }
        if (arg === '--grok-home' || arg === '--claude-settings') {
            const value = argv[i + 1];
            if (value === undefined || value === '' || value.startsWith('--')) {
                return { error: `missing value for ${arg}` };
            }
            i += 1;
            if (arg === '--grok-home') parsed.grokHome = value;
            else parsed.claudeSettingsPath = value;
            continue;
        }
        return { error: `unknown flag ${arg}` };
    }
    return { error: null, ...parsed };
}

function main(argv) {
    const parsed = parseCliArgs(argv);
    if (parsed.help) {
        console.log(usageLine());
        return 0;
    }
    if (parsed.error) {
        console.error(usageLine());
        console.error(parsed.error);
        return 2;
    }
    let result;
    try {
        result = runCheck({
            grokHome: parsed.grokHome || process.env.GROK_HOME || interactiveGrokHome(),
            defaultGrokHome: interactiveGrokHome(),
            claudeSettingsPath: parsed.claudeSettingsPath,
            claudeBare: parsed.claudeBare,
        });
    } catch (err) {
        const faultPath = err && err.path ? err.path : '';
        const code = err && err.code ? err.code : 'ERR';
        console.error(`fault: ${faultPath}: ${code}`);
        return 3;
    }
    if (parsed.json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        for (const item of result.findings) {
            console.log(`[${item.severity}] ${item.source}: ${item.message}`);
        }
        console.log(`ready: ${result.ready}`);
    }
    return result.ready ? 0 : 1;
}

module.exports = {
    parseTomlHookState,
    evaluateGrokHome,
    evaluateClaudeSettings,
    summarize,
    runCheck,
};

if (require.main === module) {
    process.exit(main(process.argv.slice(2)));
}
