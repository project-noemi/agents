const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { extractBetweenMarkers } = require('../scripts/context_helpers');

const repoRoot = path.join(__dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'generated');
const fixtures = [
    { marker: 'GLOBAL_MANDATES', file: 'global-mandates.md' },
    { marker: 'AGENT_INDEX', file: 'agent-index.md' },
    { marker: 'SKILLS_INJECTIONS', file: 'active-skills.md' },
    { marker: 'MCP_INJECTIONS', file: 'active-mcps.md' }
];

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readFixture(fileName) {
    return fs.readFileSync(path.join(fixtureDir, fileName), 'utf8').trim();
}

for (const generatedFile of ['GEMINI.md', 'CLAUDE.md']) {
    for (const fixture of fixtures) {
        test(`${generatedFile} matches golden fixture for ${fixture.marker}`, () => {
            const content = read(generatedFile);
            const extracted = extractBetweenMarkers(content, fixture.marker);
            assert.equal(
                extracted,
                readFixture(fixture.file),
                `${generatedFile} diverged from fixture ${fixture.file}. Run npm run test:update-fixtures if the change is intentional.`
            );
        });
    }
}
