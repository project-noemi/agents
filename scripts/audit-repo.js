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
    buildSkillsDist
} = require('./context_helpers');

const repoRoot = path.join(__dirname, '..');
const agentsDir = path.join(repoRoot, 'agents');
const skillsDir = path.join(repoRoot, 'skills');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');

let failed = false;

function fail(message) {
    failed = true;
    console.error(`AUDIT FAIL: ${message}`);
}

// Mandatory Audit Log JSON schema keys per Requirement §3 (Decision [2026-05-20]).
const REQUIRED_AUDIT_LOG_KEYS = ['task', 'inputs', 'actions', 'risks', 'result'];

// Phase 0 Assessment Kit inventory mandated by Requirement §1 (Decision [2026-07-05-0011]).
const PHASE_ZERO_KIT_FILES = [
    'security-assessment.md',
    'ai-readiness-assessment.md',
    'network-security-assessment.md',
    'PRACTITIONER_NOTES.md',
    'consent-template.md',
    'report-template.md',
    'roadmap-template.md',
    'readiness-rubric.md'
];

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
                const auditLog = JSON.parse(jsonStr);
                // Mandatory JSON schema validation per Requirement §3 and Decision [2026-05-20]
                // (Audit Script Coverage Expansion): every Audit Log must carry the five
                // canonical keys so orchestrators can consume records uniformly.
                const missingKeys = REQUIRED_AUDIT_LOG_KEYS.filter((key) => !(key in auditLog));
                if (missingKeys.length > 0) {
                    fail(`${relativePath} Audit Log JSON is missing mandatory keys: ${missingKeys.join(', ')}`);
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

// Licensing posture consistency check — resolves Clarification [2026-07-11] Licensing
// Posture Missing from the Requirements Contract (Decision [2026-07-13-0002]).
// Verifies that the FSL-1.1-Apache-2.0 declaration in LICENSE and the SPDX identifier
// in package.json stay aligned, and that the Transparent Source Guarantee doc is present.
const CANONICAL_LICENSE_ID = 'FSL-1.1-Apache-2.0';
const CANONICAL_LICENSE_HEADER = 'Functional Source License, Version 1.1, Apache 2.0 Future License';

// The github protocol carries the machine-identity PR-authorship rules and the
// develop-only merge flow — the fleet's operational safety contract. Summary
// injection (Decision [2026-08-13-0001]) keeps it fully inline via
// INLINE_FULL_PROTOCOLS; this guard fails the audit if that invariant ever
// silently degrades (e.g. a config or generator change drops the full body).
function checkInlineSafetyContract() {
    let config;
    try {
        config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'mcp.config.json'), 'utf8'));
    } catch (error) {
        fail(`mcp.config.json unreadable: ${error.message}`);
        return;
    }
    if (!Array.isArray(config.active_mcps) || !config.active_mcps.includes('github')) {
        return;
    }
    for (const outputPath of generatedOutputs) {
        if (!fs.existsSync(outputPath)) {
            continue;
        }
        const content = fs.readFileSync(outputPath, 'utf8');
        if (!content.includes('PR Authorship (Machine Identity)')) {
            fail(`${path.basename(outputPath)}: github is an active MCP but its full protocol (PR Authorship / Machine Identity rules) is not inline — the always-loaded safety contract has been lost.`);
        }
    }
}

// skills-dist/ is an immutable build artifact: byte-determined by skills/ +
// AGENTS.md via the same builder generate_all.js uses. Re-running the builder
// in memory and demanding byte equality makes manual edits, stale files, and
// missing artifacts all loud (Decision: skills.sh Phase 1 distribution).
function checkSkillsDistDeterminism() {
    console.log('Auditing skills-dist build artifacts (determinism)...');

    let expected;
    try {
        expected = buildSkillsDist({
            skillsDir: path.join(repoRoot, 'skills'),
            agentsMdPath,
            repoRoot
        });
    } catch (error) {
        fail(`skills-dist builder failed: ${error.message}`);
        return;
    }

    const expectedByRel = new Map(expected.map((file) => [file.relPath, file.content]));

    for (const [relPath, content] of expectedByRel) {
        const fullPath = path.join(repoRoot, relPath);
        if (!fs.existsSync(fullPath)) {
            fail(`${relPath} is missing — skills-dist/ is generated output; run \`npm run generate\` (node scripts/generate_all.js).`);
            continue;
        }
        if (fs.readFileSync(fullPath, 'utf8') !== content) {
            fail(`${relPath} has drifted from its generated content — manual edits to skills-dist/ are prohibited; run \`npm run generate\` (node scripts/generate_all.js).`);
        }
    }

    const distDir = path.join(repoRoot, 'skills-dist');
    if (!fs.existsSync(distDir)) {
        return; // every artifact already reported missing above
    }
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (!expectedByRel.has(path.relative(repoRoot, fullPath))) {
                fail(`${path.relative(repoRoot, fullPath)} is not a generated artifact — skills-dist/ is immutable build output; remove it or run \`npm run generate\`.`);
            }
        }
    };
    walk(distDir);
}

function checkLicensingPosture() {
    const licensePath = path.join(repoRoot, 'LICENSE');
    const packageJsonPath = path.join(repoRoot, 'package.json');
    const transparentSourcePath = path.join(repoRoot, 'docs/TRANSPARENT_SOURCE.md');

    if (!fs.existsSync(licensePath)) {
        fail('LICENSE file is missing at the repository root.');
    } else {
        const licenseContent = fs.readFileSync(licensePath, 'utf8');
        if (!licenseContent.includes(CANONICAL_LICENSE_HEADER)) {
            fail(`LICENSE does not start with the canonical FSL header ("${CANONICAL_LICENSE_HEADER}").`);
        }
        if (!licenseContent.includes(CANONICAL_LICENSE_ID)) {
            fail(`LICENSE does not declare the SPDX identifier "${CANONICAL_LICENSE_ID}".`);
        }
    }

    if (!fs.existsSync(packageJsonPath)) {
        fail('package.json is missing at the repository root.');
    } else {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (pkg.license !== CANONICAL_LICENSE_ID) {
                fail(`package.json "license" field is "${pkg.license || '(unset)'}", expected "${CANONICAL_LICENSE_ID}" per Decision [2026-07-05-0004].`);
            }
        } catch (error) {
            fail(`package.json is not valid JSON: ${error.message}`);
        }
    }

    if (!fs.existsSync(transparentSourcePath)) {
        fail('docs/TRANSPARENT_SOURCE.md is missing; the Transparent Source Guarantee must be present per Decision [2026-07-05-0004].');
    }
}

// Phase 0 Assessment Kit presence check — resolves the "Phase 0 Audit Gap" limitation
// (Decision [2026-07-05-0011]). Requirement §1 enumerates the kit's contents; a missing
// file breaks the buyer's first-contact experience and fails the audit as a fatal error.
function checkPhaseZeroKit() {
    console.log('Auditing Phase 0 Assessment Kit inventory...');
    const kitDir = path.join(repoRoot, 'docs/phase-zero-assessment');
    if (!fs.existsSync(kitDir)) {
        fail('docs/phase-zero-assessment/ directory is missing; Requirement §1 mandates the Phase 0 Assessment Kit.');
        return;
    }
    for (const fileName of PHASE_ZERO_KIT_FILES) {
        if (!fs.existsSync(path.join(kitDir, fileName))) {
            fail(`docs/phase-zero-assessment/${fileName} is missing; Requirement §1 mandates it as part of the Phase 0 Assessment Kit.`);
        }
    }
}

// Merge-gate invariant check — resolves Clarification [2026-07-14] Merge-Gate Invariant
// Audit Guard (Decision [2026-08-01-0002]). Requirement §7 makes `develop` the ONLY valid
// PR source into `main` with no exceptions of any kind, so the gate workflow's source-branch
// condition must be the single literal `develop` comparison. Any regex/wildcard exception
// (`=~`) or extra branch clause is a fatal failure: this is the control that direct-to-main
// automation repeatedly edited to unblock itself during 2026-07, so drift here is a
// governance incident, not a style choice.
const MERGE_GATE_PATH = '.github/workflows/require-develop-source.yml';
const CANONICAL_GATE_CONDITION = 'if [[ "${{ github.head_ref }}" != "develop" ]]; then';

function checkMergeGateInvariant() {
    console.log('Auditing merge-gate invariant (develop is the only PR source into main)...');
    const gatePath = path.join(repoRoot, MERGE_GATE_PATH);
    if (!fs.existsSync(gatePath)) {
        fail(`${MERGE_GATE_PATH} is missing; Requirement §7 mandates the develop-only merge gate.`);
        return;
    }
    const content = fs.readFileSync(gatePath, 'utf8');
    if (content.includes('=~')) {
        fail(`${MERGE_GATE_PATH} contains a regex/wildcard branch exception ("=~"); Requirement §7 forbids ALL bypasses of the develop-only rule (Decision [2026-08-01-0002]).`);
    }
    const conditionLines = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('if ') && line.includes('github.head_ref'));
    if (conditionLines.length === 0) {
        fail(`${MERGE_GATE_PATH} no longer tests github.head_ref; the develop-only source check appears to have been removed.`);
        return;
    }
    for (const line of conditionLines) {
        if (line !== CANONICAL_GATE_CONDITION) {
            fail(`${MERGE_GATE_PATH} source-branch condition drifted from the canonical develop-only check. Found: ${line}`);
        }
    }
}

function main() {
    checkTemplates();
    checkInlineSafetyContract();
    checkPersonas();
    checkSkills();
    checkGeneratedOutputs();
    checkSkillsDistDeterminism();
    checkLicensingPosture();
    checkPhaseZeroKit();
    checkMergeGateInvariant();

    if (failed) {
        process.exit(1);
    }

    console.log('Repository audit passed.');
}

main();
