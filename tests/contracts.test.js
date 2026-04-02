const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    REQUIRED_AGENT_SECTIONS,
    REQUIRED_GLOBAL_SECTIONS,
    REQUIRED_TEMPLATE_MARKERS,
    discoverAgents,
    extractAgentHeadings,
    extractTopLevelSections
} = require('../scripts/context_helpers');

const repoRoot = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('AGENTS.md includes the required top-level mandate sections', () => {
    const headings = extractTopLevelSections(read('AGENTS.md')).map((section) => section.title);

    for (const section of REQUIRED_GLOBAL_SECTIONS) {
        assert.ok(headings.includes(section), `Missing AGENTS.md section: ${section}`);
    }
});

test('all personas expose the required contract headings', () => {
    const agents = discoverAgents(path.join(repoRoot, 'agents'));
    assert.ok(agents.length > 0, 'Expected at least one persona');

    for (const agent of agents) {
        const headings = extractAgentHeadings(read(agent.path));
        for (const required of REQUIRED_AGENT_SECTIONS) {
            assert.ok(
                headings.some((heading) => heading === required || heading.startsWith(`${required} (`)),
                `${agent.path} is missing required heading: ${required}`
            );
        }
    }
});

test('context templates retain all required injection markers', () => {
    for (const templateName of ['GEMINI.template.md', 'CLAUDE.template.md']) {
        const template = read(templateName);
        for (const marker of REQUIRED_TEMPLATE_MARKERS) {
            assert.match(template, new RegExp(`<!-- ${marker}_START -->`));
            assert.match(template, new RegExp(`<!-- ${marker}_END -->`));
        }
    }
});

test('builder-facing docs point to the Docker Agent Home path', () => {
    const readme = read('README.md');
    assert.match(readme, /docs\/examples\/docker-agent-home\.md/);
    assert.match(readme, /npm run validate/);
});

test('contributor guide documents the canonical validation and security flow', () => {
    const contributing = read('CONTRIBUTING.md');
    assert.match(contributing, /npm run validate/);
    assert.match(contributing, /npm run test:e2e/);
    assert.match(contributing, /infisical run/);
    assert.match(contributing, /op run/);
});

test('root env template documents the shared Gemini runtime key', () => {
    const envTemplate = read('.env.template');
    assert.match(envTemplate, /^GEMINI_API_KEY=/m);
});
