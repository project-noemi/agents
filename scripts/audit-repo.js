#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    REQUIRED_AGENT_SECTIONS,
    REQUIRED_GLOBAL_SECTIONS,
    REQUIRED_TEMPLATE_MARKERS,
    buildGlobalMandates,
    discoverAgents,
    extractAgentHeadings,
    extractTopLevelSections
} = require('./context_helpers');

const repoRoot = path.join(__dirname, '..');
const agentsDir = path.join(repoRoot, 'agents');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');
const templates = [
    path.join(repoRoot, 'templates/context/GEMINI.template.md'),
    path.join(repoRoot, 'templates/context/CLAUDE.template.md')
];
const generatedOutputs = [
    path.join(repoRoot, 'GEMINI.md'),
    path.join(repoRoot, 'CLAUDE.md')
];

let failed = false;

function fail(message) {
    failed = true;
    console.error(`AUDIT FAIL: ${message}`);
}

function checkAgentsMd() {
    const content = fs.readFileSync(agentsMdPath, 'utf8');
    const sections = extractTopLevelSections(content).map((section) => section.title);
    const missing = REQUIRED_GLOBAL_SECTIONS.filter((title) => !sections.includes(title));
    if (missing.length > 0) {
        fail(`AGENTS.md missing required top-level sections: ${missing.join(', ')}`);
    }
}

function checkTemplates() {
    for (const templatePath of templates) {
        const content = fs.readFileSync(templatePath, 'utf8');
        for (const marker of REQUIRED_TEMPLATE_MARKERS) {
            const startTag = `<!-- ${marker}_START -->`;
            const endTag = `<!-- ${marker}_END -->`;
            if (!content.includes(startTag) || !content.includes(endTag)) {
                fail(`${path.basename(templatePath)} missing marker pair ${startTag} / ${endTag}`);
            }
        }
    }
}

function checkPersonas() {
    const agents = discoverAgents(agentsDir);
    for (const agent of agents) {
        const fullPath = path.join(repoRoot, agent.path);
        const content = fs.readFileSync(fullPath, 'utf8');
        const headings = extractAgentHeadings(content);
        const missing = REQUIRED_AGENT_SECTIONS.filter(
            (required) => !headings.some((heading) => heading === required || heading.startsWith(`${required} (`))
        );
        if (missing.length > 0) {
            fail(`${agent.path} missing required sections: ${missing.join(', ')}`);
        }
    }
}

function checkGeneratedOutputs() {
    let mandates;
    try {
        mandates = buildGlobalMandates(agentsMdPath);
    } catch (error) {
        fail(error.message);
        return;
    }

    const mandateHeadings = [...mandates.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]);

    for (const outputPath of generatedOutputs) {
        if (!fs.existsSync(outputPath)) {
            continue;
        }

        const content = fs.readFileSync(outputPath, 'utf8');
        for (const heading of mandateHeadings) {
            if (!content.includes(`## ${heading}`)) {
                fail(`${path.basename(outputPath)} is missing injected mandate heading: ${heading}`);
            }
        }
    }
}

function main() {
    checkAgentsMd();
    checkTemplates();
    checkPersonas();
    checkGeneratedOutputs();

    if (failed) {
        process.exit(1);
    }

    console.log('Repository audit passed.');
}

main();
