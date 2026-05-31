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
const { logAudit } = require('./audit_logger');

const repoRoot = path.join(__dirname, '..');
const agentsDir = path.join(repoRoot, 'agents');
const skillsDir = path.join(repoRoot, 'skills');
const protocolsDir = path.join(repoRoot, 'mcp-protocols');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');
const mcpConfigPath = path.join(repoRoot, 'mcp.config.json');

let failed = false;

function fail(message) {
    failed = true;
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

function auditFile(filePath, requiredSections) {
    const content = fs.readFileSync(filePath, 'utf8');
    const headings = extractAgentHeadings(content);
    const relativePath = path.relative(repoRoot, filePath);

    // Check required sections — case-insensitive heading match per Decision [2026-05-28-0004].
    // The canonical casing remains as documented; the audit tolerates cosmetic capitalization drift.
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
    // We look for the Rules & Constraints section and ensure it contains Refusal Criteria as an H3.
    // Case-insensitive per Decision [2026-05-28-0004].
    const rulesMatch = content.match(/## Rules & Constraints[\s\S]*?(\n## |$)/i);
    if (rulesMatch) {
        if (!/###\s+Refusal Criteria/i.test(rulesMatch[0])) {
            fail(`${relativePath} missing required subsection: ### Refusal Criteria under ## Rules & Constraints`);
        }
    } else {
        // If Rules & Constraints is missing, it's already flagged by the missing sections check
    }

    // Check Audit Log for valid JSON (case-insensitive heading match per Decision [2026-05-28-0004])
    const auditLogMatch = content.match(/## Audit Log\s*\n+([\s\S]*?)(?=\n## |$)/i);
    if (auditLogMatch) {
        const auditLogBody = auditLogMatch[1].trim();
        const jsonMatch = auditLogBody.match(/```json\n([\s\S]*?)\n```/) || auditLogBody.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
            const jsonStr = jsonMatch[1];
            try {
                JSON.parse(jsonStr);
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
    console.log('Auditing agent specifications...');
    const agents = discoverAgents(agentsDir);
    for (const agent of agents) {
        const fullPath = path.join(repoRoot, agent.path);
        
        // Ensure Role exists for our enhanced index
        if (!agent.role) {
            fail(`${agent.path} is missing a '## Role' section (required for the Agent Index).`);
        }

        auditFile(fullPath, REQUIRED_AGENT_SECTIONS);
    }
    console.log(`Audited ${agents.length} agents.`);
}

function checkSkills() {
    console.log('Auditing reusable skills...');
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
    console.log(`Audited ${skillFiles.length} skills.`);
}

function checkReferentialIntegrity() {
    console.log('Auditing referential integrity (mcp.config.json)...');
    if (!fs.existsSync(mcpConfigPath)) {
        fail(`mcp.config.json not found: ${mcpConfigPath}`);
        return;
    }

    let config;
    try {
        config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
    } catch (error) {
        fail(`Failed to parse mcp.config.json: ${error.message}`);
        return;
    }

    const activeMcps = config.active_mcps || [];
    const activeSkills = config.active_skills || [];

    for (const mcp of activeMcps) {
        const protocolFile = path.join(protocolsDir, `${mcp}.md`);
        if (!fs.existsSync(protocolFile)) {
            fail(`Referenced MCP protocol file missing: mcp-protocols/${mcp}.md`);
        }
    }

    for (const skill of activeSkills) {
        const skillFile = path.join(skillsDir, `${skill}.md`);
        if (!fs.existsSync(skillFile)) {
            fail(`Referenced skill file missing: skills/${skill}.md`);
        }
    }
    console.log('Referential integrity check complete.');
}

function checkBranchProtection() {
    console.log('Auditing branch protection status...');
    const protectionScript = path.join(repoRoot, 'scripts/setup-branch-protection.sh');
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

    if (!fs.existsSync(protectionScript)) {
        if (isCI) {
            fail('Branch protection script missing (scripts/setup-branch-protection.sh). This is a fatal error in CI.');
        } else {
            console.warn('AUDIT WARN: Branch protection script missing (scripts/setup-branch-protection.sh).');
        }
        return;
    }

    // Since we cannot easily check the GitHub API for actual protection status without a token,
    // and this repo focuses on local/reference patterns, we verify the script exists as a proxy
    // for the "Mandatory Enforcement" requirement in REQUIREMENT.md §7.
    console.log('✅ Branch protection setup script detected.');
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
    checkTemplates();
    checkPersonas();
    checkSkills();
    checkReferentialIntegrity();
    checkBranchProtection();
    checkGeneratedOutputs();

    logAudit(
        'Repository Audit',
        ['agents/', 'skills/', 'templates/', 'mcp.config.json'],
        ['Checked persona headings', 'Checked skill headings', 'Checked template markers', 'Checked generated outputs'],
        [],
        failed ? 'Audit Failed' : 'Audit Passed'
    );

    if (failed) {
        process.exit(1);
    }

    console.log('Repository audit passed.');
}

main();
