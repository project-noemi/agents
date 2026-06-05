#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
    REQUIRED_AGENT_SECTIONS,
    REQUIRED_GLOBAL_SECTIONS,
    REQUIRED_TEMPLATE_MARKERS,
    buildGlobalMandates,
    discoverAgents,
    extractAgentHeadings,
    readConfig
} = require('./context_helpers');
const AuditLogger = require('./audit_logger');

const repoRoot = path.join(__dirname, '..');
const agentsDir = path.join(repoRoot, 'agents');
const skillsDir = path.join(repoRoot, 'skills');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');
const mcpConfigPath = path.join(repoRoot, 'mcp.config.json');

const logger = new AuditLogger('Repository Audit');
logger.addInput('agents/').addInput('skills/').addInput('AGENTS.md').addInput('mcp.config.json');

let failed = false;

function fail(message) {
    failed = true;
    console.error(`AUDIT FAIL: ${message}`);
    logger.addRisk(message);
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

    // Check for "TBD" placeholders (Decision [2026-06-01])
    if (content.includes('TBD')) {
        fail(`${relativePath} contains "TBD" placeholders.`);
    }

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

    // Check Audit Log for valid JSON and schema (Decision [2026-04-13], [2026-06-01])
    const auditLogMatch = content.match(/## Audit Log\s*\n+([\s\S]*?)(?=\n## |$)/i);
    if (auditLogMatch) {
        const auditLogBody = auditLogMatch[1].trim();
        const jsonMatch = auditLogBody.match(/```json\n([\s\S]*?)\n```/) || auditLogBody.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
            const jsonStr = jsonMatch[1];
            try {
                const auditObj = JSON.parse(jsonStr);
                // Schema validation (Decision [2026-06-01])
                const requiredKeys = ['task', 'inputs', 'actions', 'risks', 'result'];
                const missingKeys = requiredKeys.filter(key => !(key in auditObj));
                if (missingKeys.length > 0) {
                    fail(`${relativePath} Audit Log is missing required JSON keys: ${missingKeys.join(', ')}`);
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
    console.log('Auditing agent specifications...');
    const agents = discoverAgents(agentsDir);
    for (const agent of agents) {
        const fullPath = path.join(repoRoot, agent.path);
        
        if (!agent.role) {
            fail(`${agent.path} is missing a '## Role' section (required for the Agent Index).`);
        }

        auditFile(fullPath, REQUIRED_AGENT_SECTIONS);
    }
    console.log(`Audited ${agents.length} agents.`);
    logger.addAction(`Audited ${agents.length} agents.`);
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
    logger.addAction(`Audited ${skillFiles.length} skills.`);
}

function checkConfigIntegrity() {
    console.log('Checking mcp.config.json referential integrity...');
    try {
        const { activeMcps, activeSkills } = readConfig(mcpConfigPath);

        for (const mcp of activeMcps) {
            const mcpPath = path.join(repoRoot, 'mcp-protocols', `${mcp}.md`);
            if (!fs.existsSync(mcpPath)) {
                fail(`Active MCP protocol file missing: mcp-protocols/${mcp}.md`);
            }
        }

        for (const skill of activeSkills) {
            const skillPath = path.join(repoRoot, 'skills', `${skill}.md`);
            if (!fs.existsSync(skillPath)) {
                fail(`Active skill file missing: skills/${skill}.md`);
            }
        }
    } catch (error) {
        fail(`Error reading mcp.config.json: ${error.message}`);
    }
    logger.addAction('Checked config integrity.');
}

function checkBranchProtection() {
    console.log('Checking branch protection status...');
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

    try {
        // This is a naive check; real branch protection is often server-side.
        // We look for evidence of the setup script having been run or a config file.
        // For this reference implementation, we'll check if we can push to main without a PR.
        // But that's destructive. So let's check for a marker file or git config.
        const hasProtectionScript = fs.existsSync(path.join(repoRoot, 'scripts/setup-branch-protection.sh'));

        // In a real scenario, we might use: git rev-parse --abbrev-ref HEAD
        // or check for github-specific files if they exist.
        // Decision [2026-05-20] mandates branch protection.
        // We'll emit a warning for now unless in CI.

        if (!hasProtectionScript) {
            const msg = 'Branch protection setup script missing.';
            if (isCI) fail(msg);
            else console.warn(`AUDIT WARNING: ${msg}`);
        }
    } catch (e) {
        console.warn('Could not verify branch protection status.');
    }
    logger.addAction('Checked branch protection.');
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
    checkConfigIntegrity();
    checkBranchProtection();
    checkGeneratedOutputs();

    if (failed) {
        logger.setResult('failed').emit();
        process.exit(1);
    }

    console.log('Repository audit passed.');
    logger.setResult('passed').emit();
}

main();
