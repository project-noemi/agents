const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    CONTEXT_POINTER,
    buildAgentIndex,
    buildFrameworkSection,
    buildGlobalMandates,
    buildMcpSection,
    buildSkillsSection,
    discoverAgents,
    readConfig
} = require('../scripts/context_helpers');

const repoRoot = path.join(__dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'generated');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readFixture(fileName) {
    return fs.readFileSync(path.join(fixtureDir, fileName), 'utf8').trim();
}

test('CLAUDE.md and GEMINI.md are AGENTS.md pointers', () => {
    assert.equal(read('CLAUDE.md'), CONTEXT_POINTER);
    assert.equal(read('GEMINI.md'), CONTEXT_POINTER);
});

test('builder output matches golden fixture for GLOBAL_MANDATES', () => {
    assert.equal(buildGlobalMandates(path.join(repoRoot, 'AGENTS.md')).trim(), readFixture('global-mandates.md'));
});

test('builder output matches golden fixture for AGENT_INDEX', () => {
    const agents = discoverAgents(path.join(repoRoot, 'agents'));
    assert.equal(buildAgentIndex(agents).trim(), readFixture('agent-index.md'));
});

test('builder output matches golden fixture for VALUE_LENS_INJECTIONS', () => {
    const section = buildFrameworkSection(
        path.join(repoRoot, 'value-lenses'),
        'Value Lenses',
        'The following Value Lenses are part of the NoéMI framework layer. Agents should consult the lens that matches the engagement context (e.g., performance-efficiency, care-continuity) when making trade-off decisions.'
    );
    assert.equal(section.trim(), readFixture('value-lenses.md'));
});

test('builder output matches golden fixture for OPERATING_PROFILE_INJECTIONS', () => {
    const section = buildFrameworkSection(
        path.join(repoRoot, 'operating-profiles'),
        'Operating Profiles',
        'The following Operating Profiles describe how agents should adapt their tone, cadence, and escalation behavior to different organizational contexts.',
        true
    );
    assert.equal(section.trim(), readFixture('operating-profiles.md'));
});

test('builder output matches golden fixture for SKILLS_INJECTIONS', () => {
    const config = readConfig(path.join(repoRoot, 'mcp.config.json'));
    const section = buildSkillsSection(config.activeSkills, path.join(repoRoot, 'skills'));
    assert.equal(section.trim(), readFixture('active-skills.md'));
});

test('builder output matches golden fixture for MCP_INJECTIONS', () => {
    const config = readConfig(path.join(repoRoot, 'mcp.config.json'));
    const section = buildMcpSection(config.activeMcps, path.join(repoRoot, 'mcp-protocols'));
    assert.equal(section.trim(), readFixture('active-mcps.md'));
});
