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

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

function extractLocalLinks(content) {
    const links = [];
    let match;
    while ((match = MARKDOWN_LINK_RE.exec(content)) !== null) {
        let target = match[2];
        if (target.startsWith('http') || target.startsWith('#') || target.startsWith('mailto:')) continue;
        target = target.split('#')[0];
        if (target) links.push(target);
    }
    return [...new Set(links)];
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
    for (const templateName of ['templates/context/GEMINI.template.md', 'templates/context/CLAUDE.template.md']) {
        const template = read(templateName);
        for (const marker of REQUIRED_TEMPLATE_MARKERS) {
            assert.match(template, new RegExp(`<!-- ${marker}_START -->`));
            assert.match(template, new RegExp(`<!-- ${marker}_END -->`));
        }
    }
});

test('all local markdown links in front-door docs resolve to existing files', () => {
    const frontDoorFiles = [
        'README.md',
        'docs/PROJECT_REFERENCE.md',
        'CONTRIBUTING.md',
        'docs/mcp-setup/README.md',
        'docs/visuals/README.md'
    ];

    for (const file of frontDoorFiles) {
        const content = read(file);
        const fileDir = path.dirname(path.join(repoRoot, file));
        const links = extractLocalLinks(content);
        for (const link of links) {
            const resolved = path.resolve(fileDir, link);
            assert.ok(
                fs.existsSync(resolved),
                `${file} contains broken link: ${link}`
            );
        }
    }
});

test('environment verification scripts expose path-aware beginner and docker modes', () => {
    const shellScript = read('scripts/verify-env.sh');
    const powershellScript = read('scripts/verify-env.ps1');

    assert.match(shellScript, /builder\|gemini\|claude\|codex\|docker\|n8n/);
    assert.match(shellScript, /No supported local AI client found/);
    assert.match(shellScript, /docs\/examples\/zero-to-first-agent\.md/);
    assert.match(powershellScript, /ValidateSet\("builder", "gemini", "claude", "codex", "docker", "n8n"\)/);
    assert.match(powershellScript, /No supported local AI client found/);
});

test('repo exposes the localized operating profile framework and template', () => {
    const framework = read('docs/frameworks/localized-operating-profiles.md');
    const template = read('operating-profiles/PROFILE_TEMPLATE.md');

    assert.match(framework, /simple translation/i);
    assert.match(framework, /inferred gender/i);
    assert.match(template, /## Language And Register/);
    assert.match(template, /## Do Not Assume/);
});

test('repo exposes the value lens framework, starter lenses, and template', () => {
    const framework = read('docs/frameworks/value-lenses.md');
    const template = read('value-lenses/LENS_TEMPLATE.md');
    const performance = read('value-lenses/performance-efficiency.md');
    const care = read('value-lenses/care-continuity.md');
    const balanced = read('value-lenses/balanced-enterprise.md');

    assert.match(framework, /neutral operational names/i);
    assert.match(framework, /comparison mode/i);
    assert.match(framework, /Demographic Math[ée]sis/i);
    assert.match(template, /## Core Success Question/);
    assert.match(template, /## Success Criteria/);
    assert.match(template, /## Care Capital/);
    assert.match(template, /## Demographic Footprint/);
    assert.match(template, /## Failure Modes/);
    assert.match(performance, /Lens ID:\*\* `performance-efficiency`/);
    assert.match(care, /Lens ID:\*\* `care-continuity`/);
    assert.match(balanced, /Lens ID:\*\* `balanced-enterprise`/);
});

test('visual guides contain mermaid diagrams and the index references them', () => {
    const visualsIndex = read('docs/visuals/README.md');
    const systemMap = read('docs/visuals/noemi-system-map.md');
    const audienceMap = read('docs/visuals/noemi-audience-entry-map.md');
    const runtimeFlow = read('docs/visuals/noemi-runtime-flow.md');
    const mindMap = read('docs/visuals/noemi-workshop-mind-map.md');

    assert.match(visualsIndex, /noemi-system-map\.md/);
    assert.match(systemMap, /```mermaid/);
    assert.match(audienceMap, /```mermaid/);
    assert.match(runtimeFlow, /```mermaid/);
    assert.match(mindMap, /```mermaid/);
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

test('repo pins the Node baseline consistently across CI, package metadata, and local version files', () => {
    const workflow = read('.github/workflows/validate.yml');
    const packageJson = JSON.parse(read('package.json'));
    const nvmrc = read('.nvmrc').trim();
    const nodeVersion = read('.node-version').trim();

    assert.match(workflow, /actions\/checkout@v6/);
    assert.match(workflow, /actions\/setup-node@v6/);
    assert.match(workflow, /node-version: "24"/);
    assert.equal(packageJson.engines.node, '>=24');
    assert.equal(nvmrc, '24');
    assert.equal(nodeVersion, '24');
});
