#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    REQUIRED_AGENT_SECTIONS,
    REQUIRED_SKILL_SECTIONS,
    REQUIRED_GLOBAL_SECTIONS,
    REQUIRED_TEMPLATE_MARKERS,
    buildGlobalMandates,
    discoverAgents,
    extractAgentHeadings,
    extractHeadingsWithLevel,
    extractTopLevelSections,
    headingMatches,
    isSlugCompliantName,
    refusalCriteriaIsH3UnderRules,
    validateAuditLogShape
} = require('./context_helpers');

const repoRoot = path.join(__dirname, '..');
const agentsDir = path.join(repoRoot, 'agents');
const skillsDir = path.join(repoRoot, 'skills');
const mcpProtocolsDir = path.join(repoRoot, 'mcp-protocols');
const mcpConfigPath = path.join(repoRoot, 'mcp.config.json');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');

const auditStart = Date.now();
const auditState = {
    failed: false,
    failures: [],
    counts: {
        agents: 0,
        skills: 0,
        mcps: 0,
        slug_violations: 0
    }
};

function fail(message) {
    auditState.failed = true;
    auditState.failures.push(message);
    console.error(`AUDIT FAIL: ${message}`);
}

const templates = [
    path.join(repoRoot, 'templates/context/GEMINI.template.md'),
    path.join(repoRoot, 'templates/context/CLAUDE.template.md')
];
const generatedOutputs = [
    path.join(repoRoot, 'GEMINI.md'),
    path.join(repoRoot, 'CLAUDE.md')
];

function checkTemplates() {
    for (const templatePath of templates) {
        if (!fs.existsSync(templatePath)) {
            fail(`Template not found: ${templatePath}`);
            continue;
        }
        const content = fs.readFileSync(templatePath, 'utf8');
        for (const marker of REQUIRED_TEMPLATE_MARKERS) {
            const startTag = `<!-- ${marker}_START -->`;
            const endTag = `<!-- ${marker}_END -->`;
            if (!content.includes(startTag) || !content.includes(endTag)) {
                fail(`${path.basename(templatePath)} missing marker pair: ${startTag} / ${endTag}`);
            }
        }
    }
}

function auditMarkdownFile(filePath, requiredSections, label, opts = {}) {
    const content = fs.readFileSync(filePath, 'utf8');
    const headings = extractAgentHeadings(content);

    const missing = requiredSections.filter(
        (required) => !headings.some((heading) => headingMatches(heading, required))
    );
    if (missing.length > 0) {
        fail(`${label} is missing required sections: ${missing.join(', ')}`);
    }

    // Refusal Criteria H3 enforcement under Rules & Constraints.
    if (opts.enforceRefusalH3) {
        if (!refusalCriteriaIsH3UnderRules(content)) {
            fail(`${label} missing required H3 subsection 'Refusal Criteria' under 'Rules & Constraints'`);
        }
    }

    // Audit Log JSON shape validation.
    if (opts.validateAuditLog) {
        const result = validateAuditLogShape(content);
        if (!result.ok) {
            fail(`${label} ${result.reason}`);
        }
    }
}

function checkPersonas() {
    console.log('Auditing agent specifications...');
    const agents = discoverAgents(agentsDir);
    for (const agent of agents) {
        const fullPath = path.join(repoRoot, agent.path);

        if (!agent.role) {
            fail(`${agent.path} is missing a '## Role' section (required for the Agent Index).`);
        }

        auditMarkdownFile(fullPath, REQUIRED_AGENT_SECTIONS, agent.path, {
            enforceRefusalH3: true,
            validateAuditLog: true
        });
    }
    auditState.counts.agents = agents.length;
    console.log(`Audited ${agents.length} agents.`);
}

function discoverSkills() {
    const skills = [];
    if (!fs.existsSync(skillsDir)) {
        return skills;
    }
    function walk(dir, prefix = '') {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full, path.join(prefix, entry.name));
                continue;
            }
            if (!entry.name.endsWith('.md')) {
                continue;
            }
            if (entry.name === 'SKILL_TEMPLATE.md' && prefix === '') {
                // Template itself: keep as a separate informational entry but
                // do not enforce the same contract on placeholder bodies.
                continue;
            }
            skills.push({
                path: `skills/${path.join(prefix, entry.name)}`,
                fullPath: full
            });
        }
    }
    walk(skillsDir);
    return skills;
}

function checkSkills() {
    console.log('Auditing reusable skill specifications...');
    const skills = discoverSkills();
    for (const skill of skills) {
        auditMarkdownFile(skill.fullPath, REQUIRED_SKILL_SECTIONS, skill.path, {
            enforceRefusalH3: true,
            validateAuditLog: false  // skills currently embed placeholder JSON; revisit when remediation is complete
        });
    }
    auditState.counts.skills = skills.length;
    console.log(`Audited ${skills.length} skills.`);
}

function checkConfigIntegrity() {
    console.log('Auditing mcp.config.json referential integrity...');
    if (!fs.existsSync(mcpConfigPath)) {
        fail(`mcp.config.json not found at ${mcpConfigPath}`);
        return;
    }
    let config;
    try {
        config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
    } catch (error) {
        fail(`mcp.config.json parse error: ${error.message}`);
        return;
    }
    const activeMcps = Array.isArray(config.active_mcps) ? config.active_mcps : [];
    const activeSkills = Array.isArray(config.active_skills) ? config.active_skills : [];

    for (const mcp of activeMcps) {
        const expected = path.join(mcpProtocolsDir, `${mcp}.md`);
        if (!fs.existsSync(expected)) {
            fail(`mcp.config.json active_mcps refers to missing protocol file: mcp-protocols/${mcp}.md`);
        }
    }
    for (const skill of activeSkills) {
        const expected = path.join(skillsDir, `${skill}.md`);
        if (!fs.existsSync(expected)) {
            fail(`mcp.config.json active_skills refers to missing skill file: skills/${skill}.md`);
        }
    }
    auditState.counts.mcps = activeMcps.length;
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

const NAMING_AUDIT_ROOTS = [
    'agents',
    'skills',
    'mcp-protocols',
    'docs',
    'examples',
    'tools',
    'scripts',
    'templates',
    'tests',
    'value-lenses',
    'operating-profiles'
];

const NAMING_AUDIT_IGNORE_DIRS = new Set([
    'node_modules',
    '.git',
    'coverage',
    'artifacts'
]);

function checkNamingConvention() {
    const violations = [];
    function walk(dir, relRoot) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (error) {
            return;
        }
        for (const entry of entries) {
            if (NAMING_AUDIT_IGNORE_DIRS.has(entry.name)) continue;
            const full = path.join(dir, entry.name);
            const rel = path.join(relRoot, entry.name);
            if (entry.isDirectory()) {
                if (!isSlugCompliantName(entry.name)) {
                    violations.push(rel);
                }
                walk(full, rel);
            } else if (!isSlugCompliantName(entry.name)) {
                violations.push(rel);
            }
        }
    }
    for (const root of NAMING_AUDIT_ROOTS) {
        const absRoot = path.join(repoRoot, root);
        if (!fs.existsSync(absRoot)) continue;
        walk(absRoot, root);
    }
    auditState.counts.slug_violations = violations.length;
    if (violations.length > 0) {
        // Surface naming violations as a non-fatal warning to support incremental remediation
        // without breaking CI. Promote to a hard failure once the inventory reaches zero.
        console.warn(`AUDIT WARN: ${violations.length} artifact(s) violate the English-first, slug-based naming convention:`);
        for (const violation of violations) {
            console.warn(`  - ${violation}`);
        }
    }
}

function emitAuditJsonLog(elapsed) {
    const log = {
        task: 'scripts/audit-repo.js',
        inputs: ['agents/', 'skills/', 'mcp.config.json', 'AGENTS.md', 'templates/context/'],
        actions: [
            `audited ${auditState.counts.agents} agents`,
            `audited ${auditState.counts.skills} skills`,
            `validated ${auditState.counts.mcps} mcp.config.json entries`,
            `scanned ${auditState.counts.slug_violations} naming violations`
        ],
        risks: auditState.failed ? auditState.failures.slice(0, 5) : [],
        result: auditState.failed ? 'failed' : 'passed',
        duration_ms: elapsed
    };
    process.stderr.write(`AUDIT_LOG: ${JSON.stringify(log)}\n`);
}

function main() {
    checkTemplates();
    checkPersonas();
    checkSkills();
    checkConfigIntegrity();
    checkGeneratedOutputs();
    checkNamingConvention();

    const elapsed = Date.now() - auditStart;
    emitAuditJsonLog(elapsed);

    if (auditState.failed) {
        process.exit(1);
    }

    console.log('Repository audit passed.');
}

main();
