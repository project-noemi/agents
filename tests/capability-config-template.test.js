'use strict';

// Checks that the capability-configuration templates say what their README and
// docs/architecture/capability-configuration.md say they do. The schema itself is
// not run through a validator, to avoid a dependency; its key rules are asserted
// structurally instead.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'templates', 'capability-config');
const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));

const defaults = read('capabilities.default.json');
const overlay = read('capabilities.overlay.example.json');
const schema = read('capabilities.schema.json');

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Key-by-key deep merge: the overlay wins where it speaks, the default stays elsewhere.
function merge(base, over) {
    const out = { ...base };
    for (const [key, value] of Object.entries(over)) {
        out[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
    }
    return out;
}

// Every key path in `over` that does not exist in `base`.
function unknownPaths(base, over, prefix = '') {
    const found = [];
    for (const [key, value] of Object.entries(over)) {
        const here = prefix ? `${prefix}.${key}` : key;
        if (!(key in base)) {
            found.push(here);
        } else if (isObject(value) && isObject(base[key])) {
            found.push(...unknownPaths(base[key], value, here));
        }
    }
    return found;
}

const REQUIRED_IDS = { 'social-network': ['authorId'], email: ['senderId'] };

// Both switches must say yes, and the unit must hold its own identifiers.
function usable(config, unitId, channelId) {
    const platform = config.channels?.[channelId];
    const account = config.units?.[unitId]?.channels?.[channelId];
    if (!platform?.enabled || !account?.enabled) {
        return false;
    }
    return (REQUIRED_IDS[channelId] || []).every((key) => typeof account[key] === 'string' && account[key] !== '');
}

const merged = merge(defaults, overlay);

test('the default switches every channel off, platform-wide and per unit', () => {
    for (const [id, channel] of Object.entries(defaults.channels)) {
        assert.equal(channel.enabled, false, `channels.${id}`);
    }
    for (const [unitId, unit] of Object.entries(defaults.units)) {
        for (const [id, account] of Object.entries(unit.channels)) {
            assert.equal(account.enabled, false, `units.${unitId}.channels.${id}`);
        }
    }
});

test('the overlay only names keys the default already has', () => {
    assert.deepEqual(unknownPaths(defaults, overlay), []);
});

test('a key absent from the overlay is inherited, not switched off', () => {
    assert.equal(merged.agents.reporter, true);
    assert.equal(merged.agents.writer, false);
    assert.equal(merged.units['unit-a'].label, 'Unit A');
    assert.equal(merged.units['unit-a'].channels['social-network'].maxLength, 3000);
});

test('a channel is usable only for the unit whose own switch and identifiers are set', () => {
    assert.equal(usable(merged, 'unit-a', 'social-network'), true);
    assert.equal(usable(merged, 'unit-b', 'social-network'), false);
    assert.equal(usable(merged, 'unit-a', 'email'), false);
    assert.equal(usable(merged, 'unit-b', 'email'), false, 'absent means off');
});

test('the platform switch alone, or the unit switch alone, is not enough', () => {
    const platformOff = merge(merged, { channels: { 'social-network': { enabled: false } } });
    assert.equal(usable(platformOff, 'unit-a', 'social-network'), false);

    const unitOnly = merge(defaults, { units: { 'unit-a': { channels: { 'social-network': { enabled: true, authorId: 'x' } } } } });
    assert.equal(usable(unitOnly, 'unit-a', 'social-network'), false);
});

test('switched on but incomplete is not usable', () => {
    const incomplete = merge(merged, { units: { 'unit-b': { channels: { 'social-network': { enabled: true } } } } });
    assert.equal(usable(incomplete, 'unit-b', 'social-network'), false);
});

test('the schema refuses unknown keys and keeps identifiers out of the platform level', () => {
    assert.equal(schema.additionalProperties, false);
    const platformChannel = schema.properties.channels.additionalProperties;
    assert.equal(platformChannel.additionalProperties, false);
    assert.ok(!('authorId' in platformChannel.properties));
    assert.ok(!('senderId' in platformChannel.properties));
    assert.equal(schema.$defs.unit.additionalProperties, false);
});

test('the schema requires each channel\'s identifiers once it is switched on', () => {
    for (const [def, ids] of [['socialNetworkAccount', REQUIRED_IDS['social-network']], ['emailAccount', REQUIRED_IDS.email]]) {
        const account = schema.$defs[def];
        assert.equal(account.if.properties.enabled.const, true, def);
        assert.deepEqual(account.then.required, ids, def);
    }
});

test('no credential-shaped key appears in any template', () => {
    const text = ['capabilities.default.json', 'capabilities.overlay.example.json']
        .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
        .join('\n');
    assert.doesNotMatch(text, /"[^"]*(token|secret|password|apiKey)[^"]*"\s*:/i);
});
