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
const skillsDir = path.join(repoRoot, 'skills');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');

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

function main() {
    checkTemplates();
    checkPersonas();
    checkSkills();
    checkGeneratedOutputs();
    checkLicensingPosture();

    if (failed) {
        process.exit(1);
    }

    console.log('Repository audit passed.');
}

main();
