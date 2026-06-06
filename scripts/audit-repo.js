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
    extractTopLevelSections,
    readConfig
} = require('./context_helpers');
const { emitAuditLog } = require('./audit_logger');

const repoRoot = path.join(__dirname, '..');
const agentsDir = path.join(repoRoot, 'agents');
const skillsDir = path.join(repoRoot, 'skills');
const protocolsDir = path.join(repoRoot, 'mcp-protocols');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');
const mcpConfigPath = path.join(repoRoot, 'mcp.config.json');

let failed = false;
const auditActions = [];
const auditRisks = [];

function fail(message) {
    failed = true;
    console.error(`AUDIT FAIL: ${message}`);
    auditRisks.push(message);
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
    auditActions.push('Checking context templates for required markers');
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

function auditFile(filePath, requiredSections) {
    const content = fs.readFileSync(filePath, 'utf8');
    const headings = extractAgentHeadings(content);
    const relativePath = path.relative(repoRoot, filePath);

    // Check required sections — case-insensitive heading match per Decision [2026-05-28-0004].
    const missing = requiredSections.filter((required) => {
        const requiredLower = required.toLowerCase();
        return !headings.some((heading) => {
            const headingLower = heading.toLowerCase();
            return headingLower === requiredLower
                || headingLower.startsWith(`${requiredLower} (`);
        });
    });
    if (missing.length > 0) {
        fail(`${relativePath} is missing required sections: ${missing.join(', ')}`);
    }

    // Check mandatory Refusal Criteria subsection under Rules & Constraints (Decision [2026-04-13])
    const rulesMatch = content.match(/## Rules & Constraints[\s\S]*?(\n## |$)/i);
    if (rulesMatch) {
        if (!/###\s+Refusal Criteria/i.test(rulesMatch[0])) {
            fail(`${relativePath} missing required subsection: ### Refusal Criteria under ## Rules & Constraints`);
        }
    }

    // Check Audit Log for valid JSON and mandatory schema
    const auditLogMatch = content.match(/## Audit Log\s*\n+([\s\S]*?)(?=\n## |$)/i);
    if (auditLogMatch) {
        const auditLogBody = auditLogMatch[1].trim();
        const jsonMatch = auditLogBody.match(/```json\n([\s\S]*?)\n```/) || auditLogBody.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
            const jsonStr = jsonMatch[1];
            try {
                const parsed = JSON.parse(jsonStr);
                const requiredKeys = ['task', 'inputs', 'actions', 'risks', 'result'];
                const missingKeys = requiredKeys.filter(key => !(key in parsed));
                if (missingKeys.length > 0) {
                    fail(`${relativePath} Audit Log JSON missing mandatory keys: ${missingKeys.join(', ')}`);
                }
            } catch (error) {
                fail(`${relativePath} contains invalid JSON in Audit Log: ${error.message}`);
            }
        } else {
            fail(`${relativePath} missing mandatory JSON shape in Audit Log.`);
        }
    } else {
        fail(`${relativePath} is missing a '## Audit Log' section.`);
    }
}

function checkPersonas() {
    auditActions.push('Auditing agent specifications');
    const agents = discoverAgents(agentsDir);
    for (const agent of agents) {
        const fullPath = path.join(repoRoot, agent.path);
        if (!agent.role) {
            fail(`${agent.path} is missing a '## Role' section.`);
        }
        auditFile(fullPath, REQUIRED_AGENT_SECTIONS);
    }
}

function checkSkills() {
    auditActions.push('Auditing reusable skills');
    if (!fs.existsSync(skillsDir)) {
        console.warn('Skills directory not found, skipping skills audit.');
        return;
    }

    const REQUIRED_SKILL_SECTIONS = [
        'Purpose',
        'Inputs',
        'Procedure',
        'Outputs',
        'Data Inventory',
        'Rules & Constraints (4D Diligence)',
        'Boundaries',
        'Audit Log'
    ];

    function discoverSkills(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(discoverSkills(fullPath));
            } else if (file.endsWith('.md') && file !== 'SKILL_TEMPLATE.md') {
                results.push(fullPath);
            }
        });
        return results;
    }

    const skillFiles = discoverSkills(skillsDir);
    for (const fullPath of skillFiles) {
        auditFile(fullPath, REQUIRED_SKILL_SECTIONS);
    }
}

function checkReferentialIntegrity() {
    auditActions.push('Checking referential integrity in mcp.config.json');
    if (!fs.existsSync(mcpConfigPath)) {
        fail('mcp.config.json not found');
        return;
    }

    try {
        const { activeMcps, activeSkills } = readConfig(mcpConfigPath);

        for (const mcp of activeMcps) {
            const mcpPath = path.join(protocolsDir, `${mcp}.md`);
            if (!fs.existsSync(mcpPath)) {
                fail(`Active MCP '${mcp}' referenced in mcp.config.json but file missing: ${path.relative(repoRoot, mcpPath)}`);
            }
        }

        for (const skill of activeSkills) {
            const skillPath = path.join(skillsDir, `${skill}.md`);
            if (!fs.existsSync(skillPath)) {
                fail(`Active Skill '${skill}' referenced in mcp.config.json but file missing: ${path.relative(repoRoot, skillPath)}`);
            }
        }
    } catch (error) {
        fail(`Error reading mcp.config.json: ${error.message}`);
    }
}

function checkGeneratedOutputs() {
    auditActions.push('Checking generated outputs for mandate alignment');
    let mandates;
    try {
        mandates = buildGlobalMandates(agentsMdPath);
    } catch (error) {
        fail(error.message);
        return;
    }

    const mandateHeadings = [...mandates.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]);

    for (const outputPath of generatedOutputs) {
        if (!fs.existsSync(outputPath)) continue;
        const content = fs.readFileSync(outputPath, 'utf8');
        for (const heading of mandateHeadings) {
            if (!content.includes(`## ${heading}`)) {
                fail(`${path.basename(outputPath)} is missing injected mandate heading: ${heading}`);
            }
        }
    }
}

function main() {
    checkTemplates();
    checkPersonas();
    checkSkills();
    checkReferentialIntegrity();
    checkGeneratedOutputs();

    emitAuditLog({
        task: 'Repository Audit',
        inputs: [agentsDir, skillsDir, mcpConfigPath, agentsMdPath],
        actions: auditActions,
        risks: auditRisks,
        result: failed ? 'FAILED' : 'PASSED'
    });

    if (failed) {
        process.exit(1);
    }
}

main();
