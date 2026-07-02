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
const mcpConfigPath = path.join(repoRoot, 'mcp.config.json');
const mcpProtocolsDir = path.join(repoRoot, 'mcp-protocols');
const phaseZeroDir = path.join(repoRoot, 'docs', 'phase-zero-assessment');

// Audit-Log JSON schema (Decision [2026-05-20] Audit Script Coverage Expansion).
// Required fields per REQUIREMENTS.md §2 "Audit Log Shape".
const AUDIT_LOG_REQUIRED_FIELDS = ['task', 'inputs', 'actions', 'risks', 'result'];

// Substantive-compliance sentinel (Decision [2026-07-02] Substantive Placeholder Rejection).
// Files containing these sentinels in mandatory persona/skill sections fail the audit.
const PLACEHOLDER_SENTINELS = [/\bTBD\b/i, /\bplaceholder\b/i];
const PLACEHOLDER_TARGET_SECTIONS = ['Data Inventory', 'Refusal Criteria'];

// Phase 0 Assessment Kit (REQUIREMENTS.md §1). All must exist under docs/phase-zero-assessment/.
const PHASE_ZERO_REQUIRED = [
    'security-assessment.md',
    'ai-readiness-assessment.md',
    'network-security-assessment.md',
    'PRACTITIONER_NOTES.md',
    'consent-template.md',
    'report-template.md',
    'roadmap-template.md',
    'readiness-rubric.md'
];

let failed = false;
const failures = [];
const auditActions = [];

function fail(message) {
    failed = true;
    failures.push(message);
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

    // Check Audit Log for valid JSON + mandated schema fields
    // (Decision [2026-05-20] Audit Script Coverage Expansion + Decision [2026-07-02]
    // Audit Log Schema Enforcement). Structural JSON validation was in place; this now
    // also verifies the five canonical fields required by REQUIREMENTS.md §2.
    const auditLogMatch = content.match(/## Audit Log\s*\n+([\s\S]*?)(?=\n## |$)/i);
    if (auditLogMatch) {
        const auditLogBody = auditLogMatch[1].trim();
        const jsonMatch = auditLogBody.match(/```json\n([\s\S]*?)\n```/) || auditLogBody.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
            const jsonStr = jsonMatch[1];
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    const missingFields = AUDIT_LOG_REQUIRED_FIELDS.filter(
                        (field) => !Object.prototype.hasOwnProperty.call(parsed, field)
                    );
                    if (missingFields.length > 0) {
                        fail(`${relativePath} Audit Log JSON is missing required fields: ${missingFields.join(', ')}`);
                    }
                }
                // A non-object (e.g., raw array/string) is silently tolerated here as a
                // template artifact but the field-presence check above only runs on objects.
            } catch (error) {
                fail(`${relativePath} contains invalid JSON in Audit Log: ${error.message}`);
            }
        } else {
            fail(`${relativePath} missing mandatory JSON shape in Audit Log.`);
        }
    } else {
        fail(`${relativePath} is missing a '## Audit Log' section.`);
    }

    // Substantive placeholder rejection (AGENTS.md "Substantive Compliance" + Decision
    // [2026-07-02] Substantive Placeholder Rejection — Warn-Then-Enforce).
    // Files with "TBD" or "placeholder" in mandatory section bodies are flagged.
    // Enforcement is gated by NOEMI_AUDIT_SUBSTANTIVE=strict so the check ships as
    // infrastructure now and can be flipped to fatal once the skill library remediates
    // its TBD backlog. In non-strict mode it's a warning that still counts for
    // observability but does not fail the audit.
    const strictSubstantive = process.env.NOEMI_AUDIT_SUBSTANTIVE === 'strict';
    for (const sectionName of PLACEHOLDER_TARGET_SECTIONS) {
        const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Support both ## and ### since Refusal Criteria is an H3, Data Inventory is H2.
        const re = new RegExp(`^#{2,3}\\s+${escaped}\\s*\\n+([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`, 'im');
        const m = content.match(re);
        if (m) {
            const body = m[1];
            for (const sentinel of PLACEHOLDER_SENTINELS) {
                if (sentinel.test(body)) {
                    const msg = `${relativePath} contains placeholder (${sentinel}) inside mandatory section '${sectionName}'.`;
                    if (strictSubstantive) {
                        fail(msg);
                    } else {
                        console.warn(`AUDIT WARN: ${msg}`);
                    }
                    break;
                }
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

function checkMcpConfigIntegrity() {
    // Referential integrity for mcp.config.json (Decision [2026-07-02] MCP Config Referential Integrity).
    if (!fs.existsSync(mcpConfigPath)) {
        // Not fatal — repo may be forked without a config; audit continues.
        return;
    }
    let cfg;
    try {
        cfg = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
    } catch (error) {
        fail(`mcp.config.json is not valid JSON: ${error.message}`);
        return;
    }
    const activeMcps = Array.isArray(cfg.active_mcps) ? cfg.active_mcps : [];
    const activeSkills = Array.isArray(cfg.active_skills) ? cfg.active_skills : [];
    for (const mcp of activeMcps) {
        const p = path.join(mcpProtocolsDir, `${mcp}.md`);
        if (!fs.existsSync(p)) {
            fail(`mcp.config.json active_mcps references missing file: mcp-protocols/${mcp}.md`);
        }
    }
    for (const skill of activeSkills) {
        const p = path.join(skillsDir, `${skill}.md`);
        if (!fs.existsSync(p)) {
            fail(`mcp.config.json active_skills references missing file: skills/${skill}.md`);
        }
    }
    auditActions.push(`mcp.config referential integrity checked (${activeMcps.length} mcps, ${activeSkills.length} skills)`);
}

function checkPhaseZeroKit() {
    // REQUIREMENTS.md §1 Phase 0 Assessment Kit inventory
    // (Decision [2026-07-02] Phase 0 Assessment Kit Audit Coverage).
    if (!fs.existsSync(phaseZeroDir)) {
        fail(`Phase 0 Assessment Kit directory missing: docs/phase-zero-assessment/`);
        return;
    }
    const missing = PHASE_ZERO_REQUIRED.filter((f) => !fs.existsSync(path.join(phaseZeroDir, f)));
    if (missing.length > 0) {
        fail(`Phase 0 Assessment Kit missing required files: ${missing.join(', ')}`);
    }
    auditActions.push(`phase-0 kit inventory checked (${PHASE_ZERO_REQUIRED.length - missing.length}/${PHASE_ZERO_REQUIRED.length} present)`);
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
    checkMcpConfigIntegrity();
    checkPhaseZeroKit();
    checkGeneratedOutputs();

    // Emit a structured JSON Audit Log to stderr for internal-tool observability
    // (AGENTS.md Internal Tool & Service Audit Logs mandate + Decision [2026-07-02]
    // Internal Tool Observability). Uses the shared scripts/audit_logger.js utility.
    auditLogger.emit({
        task: 'REPO_AUDIT',
        inputs: [`agents/`, `skills/`, `mcp.config.json`, `AGENTS.md`, `docs/phase-zero-assessment/`],
        actions: auditActions.length ? auditActions : ['ran checkTemplates,checkPersonas,checkSkills,checkMcpConfigIntegrity,checkPhaseZeroKit,checkGeneratedOutputs'],
        risks: failures.slice(0, 20),
        result: failed ? 'fail' : 'pass'
    });

    if (failed) {
        process.exit(1);
    }

    console.log('Repository audit passed.');
}

main();
