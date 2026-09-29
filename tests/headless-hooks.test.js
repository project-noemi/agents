const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
    parseTomlHookState,
    evaluateGrokHome,
    evaluateClaudeSettings,
    summarize,
    runCheck,
} = require('../scripts/check-headless-hooks.js');

// Headless readiness gate (Decision [2026-09-27-0001]).
// A hook that waits for a person has to fail before dispatch. These tests pin
// the gate: a pin under another table does not count, an unsigned requirements
// file does not survive launch, and the CLI never echoes credential files.

const SCRIPT = path.join(__dirname, '..', 'scripts', 'check-headless-hooks.js');
const PIN_TRUE = 'allow_managed_hooks_only = true\nfail_closed = true\n';
const COMPAT_OFF = '[compat.claude]\nhooks = false\n\n[compat.cursor]\nhooks = false\n';
const LOOP_HOME = '/loop/grok-home';
const INTERACTIVE_HOME = '/interactive/.grok';
const MISSING_PIN = 'allow_managed_hooks_only = true is missing from requirements.toml and managed_config.toml';
const MISSING_FAIL_CLOSED = 'fail_closed = true is missing; grok removes an unsigned requirements.toml at session start, so the pin would not survive the first run';
const MANAGED_SKIPPED = 'hook tables Stop, PostToolUse in managed_config.toml are skipped by the pin; only root-owned /etc/grok files or a signed requirements.toml can enforce hooks';

function withTempDir(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-'));
    try {
        return fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function runCli(args, envOverrides) {
    const env = { ...process.env };
    if (envOverrides) Object.assign(env, envOverrides);
    return spawnSync(process.execPath, [SCRIPT, ...args], {
        encoding: 'utf8',
        env,
    });
}

function writeReadyHome(dir) {
    fs.writeFileSync(path.join(dir, 'requirements.toml'), `${PIN_TRUE}# HEADLESS_FILE_SENTINEL\n`, 'utf8');
    fs.writeFileSync(path.join(dir, 'config.toml'), COMPAT_OFF, 'utf8');
    fs.writeFileSync(path.join(dir, 'managed_config.toml'), '# [[hooks.Stop]]\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'auth.json'), '{"token":"HEADLESS_AUTH_SENTINEL"}\n', 'utf8');
}

function isolatedHome(overrides) {
    return evaluateGrokHome({
        home: LOOP_HOME,
        defaultHome: INTERACTIVE_HOME,
        requirements: PIN_TRUE,
        config: COMPAT_OFF,
        managedConfig: null,
        ...overrides,
    });
}

test('parse ignores comments and trailing comments', () => {
    const state = parseTomlHookState([
        '# allow_managed_hooks_only = true',
        '',
        'allow_managed_hooks_only = false  # true',
        '# [[hooks.Stop]]',
        '[[hooks.PostToolUse]] # kept',
        '   # hooks = false',
    ].join('\n'));
    assert.equal(state.allowManagedHooksOnly, false);
    assert.equal(state.failClosed, null);
    assert.deepEqual(state.hookTables, ['PostToolUse']);
    assert.deepEqual(state.compat, { claude: null, cursor: null });
});

test('parse accepts the camelCase pin at the top level', () => {
    const state = parseTomlHookState([
        '# allowManagedHooksOnly = false',
        '    allowManagedHooksOnly = true  # pin',
    ].join('\n'));
    assert.equal(state.allowManagedHooksOnly, true);
    assert.deepEqual(state.hookTables, []);
});

test('a pin under [policy] is not top-level', () => {
    const state = parseTomlHookState('[policy]\nallow_managed_hooks_only = true\n');
    assert.equal(state.allowManagedHooksOnly, null);
});

test('a pin under [[hooks.Stop]] is not top-level', () => {
    const state = parseTomlHookState('[[hooks.Stop]]\nallow_managed_hooks_only = true\n');
    assert.equal(state.allowManagedHooksOnly, null);
    assert.deepEqual(state.hookTables, ['Stop']);
});

test('a non-boolean pin value engages and false does not', () => {
    assert.equal(parseTomlHookState('allow_managed_hooks_only = "yes"\n').allowManagedHooksOnly, true);
    assert.equal(parseTomlHookState('allowManagedHooksOnly = false\n').allowManagedHooksOnly, false);
    const engaged = isolatedHome({
        requirements: 'allow_managed_hooks_only = "yes"\nfail_closed = true\n',
    });
    assert.equal(engaged.findings.some((item) => item.message === MISSING_PIN), false);
    const released = isolatedHome({
        requirements: 'allow_managed_hooks_only = false\nfail_closed = true\n',
    });
    assert.equal(released.findings.some((item) => item.message === MISSING_PIN), true);
});

test('an unquoted hash starts a comment without requiring whitespace', () => {
    const state = parseTomlHookState([
        'allow_managed_hooks_only = true#pin',
        '[compat.claude]',
        'hooks = false#off',
        '[compat.cursor]',
        'hooks = false#off',
    ].join('\n'));
    assert.equal(state.allowManagedHooksOnly, true);
    assert.deepEqual(state.compat, { claude: false, cursor: false });
});

test('keys inside a multi-line string are not declarations', () => {
    const state = parseTomlHookState([
        'note = """',
        'allow_managed_hooks_only = true',
        '[[hooks.Stop]]',
        '[compat.claude]',
        'hooks = false',
        '"""',
        "note2 = '''",
        '[[hooks.PostToolUse]]',
        "'''",
        'allow_managed_hooks_only = false',
    ].join('\n'));
    assert.equal(state.allowManagedHooksOnly, false);
    assert.deepEqual(state.hookTables, []);
    assert.deepEqual(state.compat, { claude: null, cursor: null });
    assert.equal(state.failClosed, null);
});

test('parse collects [[hooks.Stop]] and [[hooks.PostToolUse]]', () => {
    const state = parseTomlHookState([
        '[[hooks.Stop]]',
        'matcher = "Bash"',
        '[[hooks.PostToolUse]]',
        'matcher = "Edit|Write"',
    ].join('\n'));
    assert.deepEqual(state.hookTables, ['Stop', 'PostToolUse']);
});

test('[[hooks."Stop"]] counts the quoted event', () => {
    assert.deepEqual(parseTomlHookState('[[hooks."Stop"]]\n').hookTables, ['Stop']);
});

test("[[hooks.'Stop']] counts the single-quoted event", () => {
    assert.deepEqual(parseTomlHookState("[[hooks.'Stop']]\n").hookTables, ['Stop']);
});

test('[hooks] array keys count as hook tables', () => {
    const state = parseTomlHookState('[hooks]\nStop = [{ type = "command" }]\nPostToolUse = []\n');
    assert.deepEqual(state.hookTables, ['Stop', 'PostToolUse']);
});

test('parse reads compat hooks under the right section only', () => {
    // `hooks = true` under [[hooks.Stop]] belongs to that table. It must not
    // flip [compat.cursor], and [compat.claude.extra] must not flip claude.
    const state = parseTomlHookState([
        'hooks = false',
        '',
        '[compat.claude]',
        'hooks = true # still imported',
        '',
        '[compat.claude.extra]',
        'hooks = false',
        '',
        '[compat.cursor]',
        'hooks = false',
        '[[hooks.Stop]]',
        'hooks = true',
        '',
        '[[hooks.PostToolUse]]',
    ].join('\n'));
    assert.deepEqual(state.compat, { claude: true, cursor: false });
    assert.deepEqual(state.hookTables, ['Stop', 'PostToolUse']);
});

test('dotted compat keys count at the top level and under [compat]', () => {
    const dotted = parseTomlHookState('compat.claude.hooks = false\ncompat.cursor.hooks = false\n');
    assert.deepEqual(dotted.compat, { claude: false, cursor: false });
    const table = parseTomlHookState('[compat]\nclaude.hooks = false\ncursor.hooks = true\n');
    assert.deepEqual(table.compat, { claude: false, cursor: true });
});

test('section header whitespace still resolves the compat path', () => {
    const state = parseTomlHookState('[ compat . claude ]\nhooks = false\n');
    assert.equal(state.compat.claude, false);
    assert.equal(state.compat.cursor, null);
});

test('fail_closed counts only as a top-level boolean', () => {
    assert.equal(parseTomlHookState('fail_closed = true\n').failClosed, true);
    assert.equal(parseTomlHookState('fail_closed = false\n').failClosed, false);
    assert.equal(parseTomlHookState('[policy]\nfail_closed = true\n').failClosed, null);
    assert.equal(parseTomlHookState('[[hooks.Stop]]\nfail_closed = true\n').failClosed, null);
});

test('a grok home equal to the interactive default is a block', () => {
    // path.resolve, not string equality: a trailing slash is the same directory.
    const home = '/var/headless-interactive';
    const result = evaluateGrokHome({
        home: `${home}/`,
        defaultHome: home,
        requirements: PIN_TRUE,
        config: COMPAT_OFF,
        managedConfig: null,
    });
    assert.deepEqual(result.findings, [{
        severity: 'block',
        source: 'GROK_HOME',
        message: 'the run would use the interactive profile',
    }]);
});

test('a symlink to the interactive home is the same directory', () => {
    withTempDir((dir) => {
        const realHome = path.join(dir, 'real-home');
        const linkHome = path.join(dir, 'link-home');
        fs.mkdirSync(realHome);
        fs.symlinkSync(realHome, linkHome);
        const result = evaluateGrokHome({
            home: linkHome,
            defaultHome: realHome,
            requirements: PIN_TRUE,
            config: COMPAT_OFF,
            managedConfig: null,
        });
        assert.deepEqual(result.findings, [{
            severity: 'block',
            source: 'GROK_HOME',
            message: 'the run would use the interactive profile',
        }]);
    });
});

test('missing requirements.toml is a block', () => {
    const result = isolatedHome({ requirements: null });
    assert.deepEqual(result.findings, [{
        severity: 'block',
        source: 'requirements.toml',
        message: MISSING_PIN,
    }]);
});

test('a false allow_managed_hooks_only pin is a block', () => {
    const result = isolatedHome({ requirements: 'allow_managed_hooks_only = false\n' });
    assert.deepEqual(result.findings, [{
        severity: 'block',
        source: 'requirements.toml',
        message: MISSING_PIN,
    }]);
});

test('a pin only in managed_config.toml is accepted', () => {
    const result = isolatedHome({
        requirements: 'fail_closed = true\n',
        managedConfig: 'allow_managed_hooks_only = true\n',
    });
    assert.deepEqual(result.findings, [{
        severity: 'info',
        source: 'GROK_HOME',
        message: 'profile is isolated',
    }]);
});

test('a pin in config.toml does not count', () => {
    const result = isolatedHome({
        requirements: 'fail_closed = true\n',
        config: `${COMPAT_OFF}\nallow_managed_hooks_only = true\n`,
        managedConfig: null,
    });
    assert.equal(result.findings.some((item) => item.message === MISSING_PIN), true);
});

test('an engaged pin without fail_closed does not survive session start', () => {
    const result = isolatedHome({
        requirements: 'allow_managed_hooks_only = true\n',
    });
    assert.deepEqual(result.findings, [{
        severity: 'block',
        source: 'requirements.toml',
        message: MISSING_FAIL_CLOSED,
    }]);
});

test('fail_closed = true keeps the unsigned pin', () => {
    const result = isolatedHome({
        requirements: 'allow_managed_hooks_only = true\nfail_closed = true\n',
    });
    assert.equal(result.findings.some((item) => item.message === MISSING_FAIL_CLOSED), false);
    assert.equal(summarize(result.findings).ready, true);
});

test('fail_closed in managed_config.toml does not keep the pin', () => {
    const result = isolatedHome({
        requirements: 'allow_managed_hooks_only = true\n',
        managedConfig: 'fail_closed = true\n',
    });
    assert.equal(result.findings[0].message, MISSING_FAIL_CLOSED);
});

test('an isolated profile with the pin and compat off is ready', () => {
    const result = isolatedHome({ managedConfig: '# [[hooks.Stop]]\n' });
    assert.deepEqual(result.findings, [{
        severity: 'info',
        source: 'GROK_HOME',
        message: 'profile is isolated',
    }]);
    assert.deepEqual(summarize(result.findings), { ready: true, blocks: 0, warns: 0, infos: 1 });
});

test('hook tables in config.toml warn that the profile is contaminated', () => {
    const result = isolatedHome({
        config: `${COMPAT_OFF}\n[[hooks.Stop]]\n[[hooks.PostToolUse]]\n`,
    });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, 'warn');
    assert.equal(result.findings[0].source, 'config.toml');
    assert.match(result.findings[0].message, /Stop/);
    assert.match(result.findings[0].message, /PostToolUse/);
    assert.match(result.findings[0].message, /contaminated/);
    assert.equal(summarize(result.findings).ready, true);
});

test('managed hook tables are skipped by the pin', () => {
    const result = isolatedHome({
        managedConfig: '[[hooks.Stop]]\n[[hooks.PostToolUse]]\n',
    });
    assert.deepEqual(result.findings, [{
        severity: 'warn',
        source: 'managed_config.toml',
        message: MANAGED_SKIPPED,
    }]);
    assert.equal(summarize(result.findings).ready, true);
});

test('compat hook imports that are not explicitly false warn once per vendor', () => {
    const result = isolatedHome({
        config: '[compat.claude]\nhooks = true\n',
    });
    assert.deepEqual(result.findings.map((item) => item.severity), ['warn', 'warn']);
    assert.equal(result.findings[0].source, 'config.toml');
    assert.equal(result.findings[1].source, 'config.toml');
    assert.match(result.findings[0].message, /\[compat\.claude\] hooks = false/);
    assert.match(result.findings[1].message, /\[compat\.cursor\] hooks = false/);
    assert.equal(summarize(result.findings).ready, true);
});

test('grok findings fire in gate order and a hit suppresses the isolated info', () => {
    const result = evaluateGrokHome({
        home: INTERACTIVE_HOME,
        defaultHome: INTERACTIVE_HOME,
        requirements: null,
        config: '[[hooks.Stop]]\n',
        managedConfig: '[[hooks.PostToolUse]]\n',
    });
    assert.deepEqual(result.findings.map((item) => `${item.severity}:${item.source}`), [
        'block:GROK_HOME',
        'block:requirements.toml',
        'warn:config.toml',
        'warn:config.toml',
        'warn:config.toml',
        'warn:managed_config.toml',
    ]);
    assert.match(result.findings[2].message, /Stop/);
    assert.match(result.findings[3].message, /compat\.claude/);
    assert.match(result.findings[4].message, /compat\.cursor/);
    assert.match(result.findings[5].message, /PostToolUse/);
    assert.equal(result.findings.some((item) => item.message === 'profile is isolated'), false);
});

test('claude bare mode is ready and does not evaluate settings text', () => {
    const result = evaluateClaudeSettings({ settingsText: '{', bare: true });
    assert.deepEqual(result.findings, [{
        severity: 'info',
        source: 'claude',
        message: 'bare mode skips hooks',
    }]);
    assert.equal(summarize(result.findings).ready, true);
});

test('claude settings that declare hooks without disableAllHooks are a block', () => {
    const text = JSON.stringify({
        hooks: {
            Stop: [{ command: 'HEADLESS_HOOK_COMMAND' }],
            PostToolUse: [],
        },
    });
    const result = evaluateClaudeSettings({ settingsText: text, bare: false });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, 'block');
    assert.equal(result.findings[0].source, 'claude-settings');
    assert.match(result.findings[0].message, /Stop/);
    assert.match(result.findings[0].message, /PostToolUse/);
    assert.equal(result.findings[0].message.includes('HEADLESS_HOOK_COMMAND'), false);
    assert.equal(summarize(result.findings).ready, false);
});

test('unsanitized hook keys are counted and not echoed', () => {
    const nasty = '$(rm -rf /)';
    const result = evaluateClaudeSettings({
        settingsText: JSON.stringify({ hooks: { [nasty]: [], Stop: [] } }),
        bare: false,
    });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, 'block');
    assert.equal(result.findings[0].message, 'hook events Stop are enabled; 1 unrecognized key(s)');
    assert.equal(result.findings[0].message.includes(nasty), false);
    const onlyNasty = evaluateClaudeSettings({
        settingsText: JSON.stringify({ hooks: { [nasty]: [] } }),
        bare: false,
    });
    assert.equal(onlyNasty.findings[0].severity, 'block');
    assert.equal(onlyNasty.findings[0].message, '1 unrecognized key(s)');
});

test('disableAllHooks true is ready', () => {
    const result = evaluateClaudeSettings({
        settingsText: '{ "disableAllHooks": true }\n',
        bare: false,
    });
    assert.deepEqual(result.findings, [{
        severity: 'info',
        source: 'claude-settings',
        message: 'disableAllHooks is true',
    }]);
    assert.equal(summarize(result.findings).ready, true);
});

test('disableAllHooks true wins even when a hooks object is present', () => {
    const text = JSON.stringify({
        disableAllHooks: true,
        hooks: { Stop: [{ command: 'HEADLESS_HOOK_COMMAND' }] },
    });
    const result = evaluateClaudeSettings({ settingsText: text, bare: false });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, 'info');
    assert.equal(result.findings[0].message.includes('HEADLESS_HOOK_COMMAND'), false);
    assert.equal(summarize(result.findings).ready, true);
});

test('a stringly disableAllHooks does not turn hooks off', () => {
    const result = evaluateClaudeSettings({
        settingsText: '{"disableAllHooks": "true", "hooks": {"Stop": []}}',
        bare: false,
    });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, 'block');
    assert.match(result.findings[0].message, /Stop/);
});

test('a BOM-prefixed settings file still parses', () => {
    const result = evaluateClaudeSettings({
        settingsText: '\uFEFF{ "disableAllHooks": true }\n',
        bare: false,
    });
    assert.equal(result.findings[0].message, 'disableAllHooks is true');
    assert.equal(summarize(result.findings).ready, true);
});

test('invalid claude settings JSON is a block and does not echo the file', () => {
    const secret = 'HEADLESS_SETTINGS_SECRET';
    const result = evaluateClaudeSettings({ settingsText: `{"hooks": ${secret}`, bare: false });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, 'block');
    assert.match(result.findings[0].message, /invalid JSON/);
    assert.equal(result.findings[0].message.includes(secret), false);
});

test('claude settings that are not a JSON object are a block', () => {
    const secret = 'HEADLESS_SETTINGS_SECRET';
    for (const text of ['[]', 'null', '42', '"x"', `"${secret}"`]) {
        const result = evaluateClaudeSettings({ settingsText: text, bare: false });
        assert.equal(result.findings.length, 1);
        assert.equal(result.findings[0].severity, 'block');
        assert.equal(result.findings[0].message, 'Claude settings are not a JSON object');
        assert.equal(result.findings[0].message.includes(secret), false);
    }
});

test('a hooks array is not a hook map', () => {
    const result = evaluateClaudeSettings({ settingsText: '{"hooks": ["Stop"]}', bare: false });
    assert.deepEqual(result.findings, [{
        severity: 'warn',
        source: 'claude-settings',
        message: 'user-level hooks are not disabled; pass --bare or disableAllHooks',
    }]);
});

test('claude settings with neither hooks nor the flag are a warning', () => {
    // Empty hooks is not "hooks present". Project-level files land here on purpose.
    const result = evaluateClaudeSettings({ settingsText: '{ "hooks": {} }\n', bare: false });
    assert.deepEqual(result.findings, [{
        severity: 'warn',
        source: 'claude-settings',
        message: 'user-level hooks are not disabled; pass --bare or disableAllHooks',
    }]);
    assert.equal(summarize(result.findings).ready, true);
});

test('absent claude settings text is a block when settings were requested', () => {
    const result = evaluateClaudeSettings({ settingsText: null, bare: false });
    assert.deepEqual(result.findings, [{
        severity: 'block',
        source: 'claude-settings',
        message: 'no Claude settings provided',
    }]);
});

test('summarize counts blocks, warns, and infos', () => {
    assert.deepEqual(summarize([
        { severity: 'block', source: 'a', message: 'a' },
        { severity: 'warn', source: 'b', message: 'b' },
        { severity: 'warn', source: 'c', message: 'c' },
        { severity: 'info', source: 'd', message: 'd' },
    ]), { ready: false, blocks: 1, warns: 2, infos: 1 });
    assert.deepEqual(summarize([
        { severity: 'warn', source: 'b', message: 'b' },
        { severity: 'info', source: 'd', message: 'd' },
    ]), { ready: true, blocks: 0, warns: 1, infos: 1 });
});

test('runCheck reads only the three grok files and the claude settings file', () => {
    const seen = [];
    const readFile = (filePath) => {
        seen.push(filePath);
        if (filePath.endsWith(`${path.sep}requirements.toml`)) return PIN_TRUE;
        if (filePath.endsWith(`${path.sep}config.toml`)) return COMPAT_OFF;
        if (filePath.endsWith(`${path.sep}managed_config.toml`)) return '';
        if (filePath.endsWith(`${path.sep}settings.json`)) return '{ "disableAllHooks": true }\n';
        throw new Error(`unexpected read ${filePath}`);
    };
    const result = runCheck({
        grokHome: LOOP_HOME,
        defaultGrokHome: INTERACTIVE_HOME,
        claudeSettingsPath: '/loop/settings.json',
        readFile,
    });
    assert.equal(result.ready, true);
    assert.deepEqual(seen.map((filePath) => path.basename(filePath)), [
        'requirements.toml',
        'config.toml',
        'managed_config.toml',
        'settings.json',
    ]);
    assert.equal(seen.some((filePath) => filePath.includes('auth.json')), false);
});

test('runCheck skips claude evaluation when neither settings nor bare is requested', () => {
    const seen = [];
    const readFile = (filePath) => {
        seen.push(path.basename(filePath));
        if (filePath.endsWith('requirements.toml')) return PIN_TRUE;
        if (filePath.endsWith('config.toml')) return COMPAT_OFF;
        return '';
    };
    const result = runCheck({
        grokHome: LOOP_HOME,
        defaultGrokHome: INTERACTIVE_HOME,
        readFile,
    });
    assert.deepEqual(seen, ['requirements.toml', 'config.toml', 'managed_config.toml']);
    assert.equal(result.ready, true);
    assert.equal(result.inputs.claudeBare, false);
    assert.equal(result.inputs.claudeSettingsPath, null);
    assert.equal(result.findings[0].message, 'profile is isolated');
    const skip = result.findings[result.findings.length - 1];
    assert.equal(skip.severity, 'info');
    assert.match(skip.message, /--claude-settings/);
    assert.match(skip.message, /--claude-bare/);
});

test('a missing profile file is treated as absent', () => {
    withTempDir((home) => {
        const result = runCheck({
            grokHome: home,
            defaultGrokHome: path.join(home, 'other'),
            claudeBare: true,
        });
        assert.equal(result.ready, false);
        assert.deepEqual(result.findings[0], {
            severity: 'block',
            source: 'requirements.toml',
            message: MISSING_PIN,
        });
    });
});

test('a missing claude settings file is a block', () => {
    withTempDir((home) => {
        fs.writeFileSync(path.join(home, 'requirements.toml'), PIN_TRUE, 'utf8');
        fs.writeFileSync(path.join(home, 'config.toml'), COMPAT_OFF, 'utf8');
        const result = runCheck({
            grokHome: home,
            defaultGrokHome: path.join(home, 'other'),
            claudeSettingsPath: path.join(home, 'missing-settings.json'),
        });
        assert.equal(result.ready, false);
        assert.equal(result.findings.some((item) => item.message === 'no Claude settings provided'), true);
    });
});

test('read errors other than a missing file propagate', () => {
    withTempDir((home) => {
        fs.mkdirSync(path.join(home, 'requirements.toml'));
        assert.throws(() => runCheck({
            grokHome: home,
            defaultGrokHome: path.join(home, 'other'),
            claudeBare: true,
        }), (err) => err && err.code === 'EISDIR' && typeof err.path === 'string');
    });
});

test('CLI exits 0 for an isolated profile in bare mode', () => {
    withTempDir((dir) => {
        writeReadyHome(dir);
        const result = runCli(['--grok-home', dir, '--claude-bare']);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /\[info\] GROK_HOME: profile is isolated/);
        assert.match(result.stdout, /\[info\] claude: bare mode skips hooks/);
        assert.match(result.stdout, /^ready: true$/m);
        const combined = `${result.stdout}${result.stderr}`;
        assert.equal(combined.includes('auth.json'), false);
        assert.equal(combined.includes('HEADLESS_AUTH_SENTINEL'), false);
        assert.equal(combined.includes('HEADLESS_FILE_SENTINEL'), false);
    });
});

test('CLI exits 1 when the pin is missing', () => {
    withTempDir((dir) => {
        writeReadyHome(dir);
        fs.writeFileSync(
            path.join(dir, 'requirements.toml'),
            '# HEADLESS_FILE_SENTINEL\nallow_managed_hooks_only = false\n',
            'utf8'
        );
        const result = runCli(['--grok-home', dir, '--claude-bare']);
        assert.equal(result.status, 1);
        assert.match(result.stdout, /^\[block\] requirements\.toml: allow_managed_hooks_only = true is missing from requirements\.toml and managed_config\.toml$/m);
        assert.match(result.stdout, /^ready: false$/m);
        const combined = `${result.stdout}${result.stderr}`;
        assert.equal(combined.includes('auth.json'), false);
        assert.equal(combined.includes('HEADLESS_AUTH_SENTINEL'), false);
        assert.equal(combined.includes('HEADLESS_FILE_SENTINEL'), false);
    });
});

test('CLI does not accept GROK_MANAGED_CONFIG=false in place of fail_closed', () => {
    withTempDir((dir) => {
        writeReadyHome(dir);
        fs.writeFileSync(path.join(dir, 'requirements.toml'), 'allow_managed_hooks_only = true\n', 'utf8');
        for (const env of [undefined, { GROK_MANAGED_CONFIG: 'false' }]) {
            const result = runCli(['--grok-home', dir, '--claude-bare'], env);
            assert.equal(result.status, 1, result.stdout);
            assert.match(result.stdout, /fail_closed = true is missing/);
        }
    });
});

test('CLI exits 2 on an unknown flag', () => {
    const result = runCli(['--not-a-real-flag']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage: node scripts\/check-headless-hooks\.js/);
    assert.match(result.stderr, /unknown flag --not-a-real-flag/);
    assert.equal(result.stdout, '');
});

test('CLI exits 2 when a flag is missing its value', () => {
    const result = runCli(['--grok-home', '--json']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage: node scripts\/check-headless-hooks\.js/);
    assert.match(result.stderr, /missing value for --grok-home/);
    assert.equal(result.stdout, '');
});

test('CLI --help prints usage and exits 0', () => {
    const result = runCli(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /usage: node scripts\/check-headless-hooks\.js/);
    assert.doesNotMatch(result.stdout, /ready:/);
});

test('CLI -h prints usage and exits 0', () => {
    const result = runCli(['-h']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /usage: node scripts\/check-headless-hooks\.js/);
    assert.equal(result.stdout.includes('ready:'), false);
});

test('CLI exits 3 when a profile path is not a file', () => {
    withTempDir((dir) => {
        fs.mkdirSync(path.join(dir, 'requirements.toml'));
        fs.writeFileSync(path.join(dir, 'secret.txt'), 'HEADLESS_FAULT_SENTINEL\n', 'utf8');
        const result = runCli(['--grok-home', dir, '--claude-bare']);
        assert.equal(result.status, 3, result.stderr);
        assert.match(result.stderr, /fault: .*requirements\.toml: EISDIR/);
        const combined = `${result.stdout}${result.stderr}`;
        assert.equal(combined.includes('HEADLESS_FAULT_SENTINEL'), false);
        assert.doesNotMatch(result.stdout, /ready:/);
    });
});

test('CLI --json output parses and does not contain auth.json', () => {
    withTempDir((dir) => {
        writeReadyHome(dir);
        const result = runCli(['--grok-home', dir, '--claude-bare', '--json']);
        assert.equal(result.status, 0, result.stderr);
        const combined = `${result.stdout}${result.stderr}`;
        assert.equal(combined.includes('auth.json'), false);
        assert.equal(combined.includes('HEADLESS_AUTH_SENTINEL'), false);
        assert.equal(combined.includes('HEADLESS_FILE_SENTINEL'), false);
        const body = JSON.parse(result.stdout);
        assert.equal(body.ready, true);
        assert.deepEqual(body.summary, { ready: true, blocks: 0, warns: 0, infos: 2 });
        assert.equal(body.inputs.claudeBare, true);
        assert.equal(body.inputs.claudeSettingsPath, null);
        assert.equal(body.inputs.grokHome, path.resolve(dir));
        assert.equal(body.findings.some((item) => item.message === 'profile is isolated'), true);
        assert.equal(body.findings.some((item) => item.message === 'bare mode skips hooks'), true);
    });
});

test('CLI defaults --grok-home from GROK_HOME', () => {
    withTempDir((dir) => {
        writeReadyHome(dir);
        const result = runCli(['--claude-bare'], { GROK_HOME: dir });
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
        assert.match(result.stdout, /^ready: true$/m);
    });
});

test('CLI --grok-home overrides GROK_HOME', () => {
    withTempDir((good) => {
        withTempDir((bad) => {
            writeReadyHome(good);
            const result = runCli(
                ['--grok-home', good, '--claude-bare'],
                { GROK_HOME: bad }
            );
            assert.equal(result.status, 0, result.stdout);
        });
    });
});

test('CLI --claude-settings with disableAllHooks exits 0', () => {
    withTempDir((dir) => {
        writeReadyHome(dir);
        const settings = path.join(dir, 'settings.json');
        fs.writeFileSync(settings, '{ "disableAllHooks": true }\n', 'utf8');
        const result = runCli(['--grok-home', dir, '--claude-settings', settings]);
        assert.equal(result.status, 0, result.stdout);
        assert.match(result.stdout, /\[info\] claude-settings: disableAllHooks is true/);
        assert.match(result.stdout, /^ready: true$/m);
        assert.equal(`${result.stdout}${result.stderr}`.includes('auth.json'), false);
    });
});

test('CLI --claude-bare wins over settings that declare hooks', () => {
    withTempDir((dir) => {
        writeReadyHome(dir);
        const settings = path.join(dir, 'settings.json');
        fs.writeFileSync(settings, JSON.stringify({ hooks: { Stop: [{ command: 'say' }] } }), 'utf8');
        const result = runCli(['--grok-home', dir, '--claude-bare', '--claude-settings', settings]);
        assert.equal(result.status, 0, result.stdout);
        assert.match(result.stdout, /bare mode skips hooks/);
        assert.doesNotMatch(result.stdout, /hook events/);
    });
});
