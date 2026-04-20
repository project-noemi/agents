#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { extractBetweenMarkers } = require('./context_helpers');

const repoRoot = path.join(__dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'generated');
const sourcePath = path.join(repoRoot, 'GEMINI.md');
const sections = [
    { marker: 'GLOBAL_MANDATES', file: 'global-mandates.md' },
    { marker: 'AGENT_INDEX', file: 'agent-index.md' },
    { marker: 'SKILLS_INJECTIONS', file: 'active-skills.md' },
    { marker: 'MCP_INJECTIONS', file: 'active-mcps.md' }
];

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

const source = fs.readFileSync(sourcePath, 'utf8');
fs.mkdirSync(fixtureDir, { recursive: true });

for (const section of sections) {
    const payload = `${extractBetweenMarkers(source, section.marker)}\n`;
    fs.writeFileSync(path.join(fixtureDir, section.file), payload, 'utf8');
    console.log(`Updated ${path.join('tests', 'fixtures', 'generated', section.file)}`);
}
