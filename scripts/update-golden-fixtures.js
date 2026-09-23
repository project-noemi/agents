#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    buildAgentIndex,
    buildFrameworkSection,
    buildGlobalMandates,
    buildMcpSection,
    buildSkillsSection,
    discoverAgents,
    readConfig
} = require('./context_helpers');

const repoRoot = path.join(__dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'generated');

function runGenerate() {
    const result = spawnSync('node', [path.join(repoRoot, 'scripts', 'generate_all.js')], {
        cwd: repoRoot,
        stdio: 'inherit'
    });

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

runGenerate();

const config = readConfig(path.join(repoRoot, 'mcp.config.json'));
const agents = discoverAgents(path.join(repoRoot, 'agents'));
fs.mkdirSync(fixtureDir, { recursive: true });

const sections = [
    { file: 'global-mandates.md', payload: buildGlobalMandates(path.join(repoRoot, 'AGENTS.md')) },
    { file: 'agent-index.md', payload: buildAgentIndex(agents) },
    {
        file: 'value-lenses.md',
        payload: buildFrameworkSection(
            path.join(repoRoot, 'value-lenses'),
            'Value Lenses',
            'The following Value Lenses are part of the NoéMI framework layer. Agents should consult the lens that matches the engagement context (e.g., performance-efficiency, care-continuity) when making trade-off decisions.'
        )
    },
    {
        file: 'operating-profiles.md',
        payload: buildFrameworkSection(
            path.join(repoRoot, 'operating-profiles'),
            'Operating Profiles',
            'The following Operating Profiles describe how agents should adapt their tone, cadence, and escalation behavior to different organizational contexts.',
            true
        )
    },
    { file: 'active-skills.md', payload: buildSkillsSection(config.activeSkills, path.join(repoRoot, 'skills')) },
    { file: 'active-mcps.md', payload: buildMcpSection(config.activeMcps, path.join(repoRoot, 'mcp-protocols')) }
];

for (const section of sections) {
    fs.writeFileSync(path.join(fixtureDir, section.file), `${section.payload.trim()}\n`, 'utf8');
    console.log(`Updated ${path.join('tests', 'fixtures', 'generated', section.file)}`);
}
