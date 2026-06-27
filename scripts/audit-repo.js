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
const auditLogger = require('./audit_logger');

const repoRoot = path.join(__dirname, '..');
const agentsDir = path.join(repoRoot, 'agents');
const skillsDir = path.join(repoRoot, 'skills');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');
const phaseZeroDir = path.join(repoRoot, 'docs/phase-zero-assessment');

let failed = false;
const auditActions = [];
const auditRisks = [];

function fail(message) {
    failed = true;
    auditRisks.push(message);
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

    // Check Audit Log for valid JSON AND mandated fields
    // (case-insensitive heading match per Decision [2026-05-28-0004])
    // Schema validation per Decision [2026-06-27-XXXX] Audit Log Schema Enforcement.
    const auditLogMatch = content.match(/## Audit Log\s*\n+([\s\S]*?)(?=\n## |$)/i);
    if (auditLogMatch) {
        const auditLogBody = auditLogMatch[1].trim();
        const jsonMatch = auditLogBody.match(/```json\n([\s\S]*?)\n```/) || auditLogBody.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
            const jsonStr = jsonMatch[1];
            try {
                const parsed = JSON.parse(jsonStr);
                const schemaErrors = auditLogger.validateAuditLog(parsed);
                if (schemaErrors.length > 0) {
                    fail(`${relativePath} Audit Log JSON fails schema validation: ${schemaErrors.join('; ')}`);
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

    // Substantive compliance check (Decision [2026-06-27-XXXX] Audit Substantive
    // Placeholder Warning): surface "TBD" / "PLACEHOLDER" strings inside the
    // mandatory Data Inventory and Refusal Criteria sections as warnings on
    // stderr. We deliberately do not fail the audit yet — Requirement §3 calls
    // for a phased rollout: warnings first to surface the substantive drift,
    // fatal once the fleet has been remediated. Tightening the gate is a
    // future decision once placeholder count reaches zero.
    const placeholderSections = [
        { heading: 'Data Inventory', level: 2 },
        { heading: 'Refusal Criteria', level: 3 }
    ];
    for (const { heading, level } of placeholderSections) {
        const hashes = '#'.repeat(level);
        const pattern = new RegExp(`^${hashes}\\s+${heading}[^\\n]*\\n([\\s\\S]*?)(?=^${hashes}\\s|^#{1,${level}}\\s|\\Z)`, 'im');
        const match = content.match(pattern);
        if (match) {
            const body = match[1].trim();
            if (/^TBD\b/i.test(body) || (/\bplaceholder\b/i.test(body) && body.length < 200)) {
                console.warn(`AUDIT WARN: ${relativePath} ${heading} section contains placeholder content ("TBD"/"placeholder"); substantive remediation pending.`);
                auditRisks.push(`placeholder content in ${relativePath} ${heading}`);
            }
        }
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

function checkPhaseZeroKit() {
    // Decision [2026-06-27-XXXX] Phase 0 Assessment Kit Audit Coverage.
    // Requirement §1 mandates a specific inventory of files in the Phase 0
    // Assessment Kit. Missing or renamed files break the buyer's first-contact
    // experience, so we surface them at audit time.
    if (!fs.existsSync(phaseZeroDir)) {
        fail(`Phase 0 Assessment Kit directory not found: docs/phase-zero-assessment/`);
        return;
    }
    const required = [
        'security-assessment.md',
        'ai-readiness-assessment.md',
        'network-security-assessment.md',
        'PRACTITIONER_NOTES.md',
        'consent-template.md',
        'report-template.md',
        'roadmap-template.md',
        'readiness-rubric.md'
    ];
    for (const file of required) {
        const fullPath = path.join(phaseZeroDir, file);
        if (!fs.existsSync(fullPath)) {
            fail(`Phase 0 Assessment Kit missing required file: docs/phase-zero-assessment/${file}`);
        }
    }
    auditActions.push(`phase-zero-kit-checked:${required.length}`);
}

function checkConfigReferentialIntegrity() {
    // Decision [2026-06-27-XXXX] mcp.config.json Referential Integrity.
    // Verify that every entry in active_mcps and active_skills maps to an
    // existing file. Missing files would silently break context generation.
    const configPath = path.join(repoRoot, 'mcp.config.json');
    if (!fs.existsSync(configPath)) return;
    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        fail(`mcp.config.json is not valid JSON: ${error.message}`);
        return;
    }
    const activeMcps = Array.isArray(config.active_mcps) ? config.active_mcps : [];
    const activeSkills = Array.isArray(config.active_skills) ? config.active_skills : [];
    for (const mcp of activeMcps) {
        const candidate = path.join(repoRoot, 'mcp-protocols', `${mcp}.md`);
        if (!fs.existsSync(candidate)) {
            fail(`mcp.config.json active_mcps references missing file: mcp-protocols/${mcp}.md`);
        }
    }
    for (const skill of activeSkills) {
        const candidate = path.join(repoRoot, 'skills', `${skill}.md`);
        if (!fs.existsSync(candidate)) {
            fail(`mcp.config.json active_skills references missing file: skills/${skill}.md`);
        }
    }
    auditActions.push(`mcp-config-referential-checked:${activeMcps.length + activeSkills.length}`);
}

function emitAuditLog() {
    // Decision [2026-04-13] / [2026-06-27-XXXX]: build utilities must emit a
    // structured JSON Audit Log to stderr on completion so orchestrators can
    // capture audit outcomes alongside fleet observability streams.
    try {
        auditLogger.emit({
            event: 'AUDIT_RUN',
            task: 'Run repository audit (audit-repo.js)',
            inputs: ['agents/', 'skills/', 'AGENTS.md', 'templates/context/', 'mcp.config.json', 'docs/phase-zero-assessment/'],
            actions: auditActions,
            risks: auditRisks,
            result: failed ? 'failure' : 'success'
        });
    } catch (error) {
        // Audit log emission must not break the primary control flow.
        console.error(`AUDIT_LOG_WARN: failed to emit audit log: ${error.message}`);
    }
}

function main() {
    checkTemplates();
    auditActions.push('templates-checked');
    checkPersonas();
    auditActions.push('personas-checked');
    checkSkills();
    auditActions.push('skills-checked');
    checkGeneratedOutputs();
    auditActions.push('generated-outputs-checked');
    checkPhaseZeroKit();
    checkConfigReferentialIntegrity();

    emitAuditLog();

    if (failed) {
        process.exit(1);
    }

    console.log('Repository audit passed.');
}

main();
