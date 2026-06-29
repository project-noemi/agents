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

// --- Supplementary audits per Decision [2026-06-19-0012] -------------------
// These checks emit warnings only (do not fail the audit) so they can land
// without forcing a coordinated cleanup. Promote individual checks to `fail()`
// once their respective drifts are remediated across the fleet.

function warn(message) {
    console.warn(`AUDIT WARN: ${message}`);
}

function walkFiles(dir, predicate) {
    const matches = [];
    if (!fs.existsSync(dir)) {
        return matches;
    }
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === '.git') {
                continue;
            }
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
            } else if (predicate(entry.name, full)) {
                matches.push(full);
            }
        }
    }
    return matches;
}

function checkNodeBaseline() {
    // Decision [2026-06-19-0012]: scan Dockerfile and docker-compose.yml for
    // node:<24 image pins. Mandate is Node 24+ across the fleet.
    const dockerFiles = walkFiles(repoRoot, (name) =>
        name === 'Dockerfile' || name === 'docker-compose.yml');
    const oldNodePattern = /\bnode:(\d+)/g;
    for (const filePath of dockerFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const relPath = path.relative(repoRoot, filePath);
        const matches = content.matchAll(oldNodePattern);
        for (const match of matches) {
            const version = Number(match[1]);
            if (Number.isFinite(version) && version < 24) {
                warn(`${relPath} pins Node ${version} (< baseline 24): ${match[0]}`);
            }
        }
    }
}

function checkAiModelBaseline() {
    // Decision [2026-06-19-0012]: scan examples/ and tests/ for non-baseline
    // Gemini model pins. Canonical baseline is models/gemini-2.5-flash.
    const targets = [
        path.join(repoRoot, 'examples'),
        path.join(repoRoot, 'tests')
    ];
    const driftPattern = /gemini-(\d+\.\d+)-flash/g;
    for (const target of targets) {
        const files = walkFiles(target, (name) =>
            /\.(py|js|json|ya?ml|md|sh)$/i.test(name));
        for (const filePath of files) {
            const content = fs.readFileSync(filePath, 'utf8');
            const relPath = path.relative(repoRoot, filePath);
            const matches = content.matchAll(driftPattern);
            for (const match of matches) {
                if (match[1] !== '2.5') {
                    warn(`${relPath} pins Gemini ${match[0]} (canonical baseline: gemini-2.5-flash)`);
                }
            }
        }
    }
}

function checkNamingConvention() {
    // Decision [2026-06-19-0012]: enforce English-first, slug-based naming
    // across content directories. Filename rule: lowercase letters, digits,
    // hyphens, underscores, dots only. Uppercase, spaces, and non-ASCII fail.
    // Standard upper-case scaffolding files (e.g. README.md) are allowed.
    const SCOPED_DIRS = ['docs', 'agents', 'skills', 'examples', 'tools'];
    const ALLOWED_UPPER = new Set([
        'README.md',
        'LICENSE',
        'AGENTS.md',
        'CLAUDE.md',
        'GEMINI.md',
        'CONTRIBUTING.md',
        'CLARIFICATIONS.md',
        'DECISION_LOG.md',
        'METHODOLOGY.md',
        'GOVERNANCE.md',
        'REQUIREMENTS.md',
        'PROJECT_REFERENCE.md',
        'PHASE_ZERO_SECURITY_BASELINE.md',
        'UPSTREAM_SYNC.md',
        'PRACTITIONER_NOTES.md',
        'SOVEREIGN_LLM_GUIDELINES.md',
        'DEV_AGENT_PROMPT.md',
        'AGENT_TEMPLATE.md',
        'SKILL_TEMPLATE.md',
        'LENS_TEMPLATE.md',
        'PROFILE_TEMPLATE.md'
    ]);
    const slugPattern = /^[a-z0-9][a-z0-9._-]*$/;
    for (const dir of SCOPED_DIRS) {
        const fullDir = path.join(repoRoot, dir);
        const files = walkFiles(fullDir, () => true);
        for (const filePath of files) {
            const basename = path.basename(filePath);
            if (ALLOWED_UPPER.has(basename)) {
                continue;
            }
            // Template files allowed: e.g. SOMETHING_TEMPLATE.md
            if (/^[A-Z][A-Z0-9_]*\.md$/.test(basename)) {
                continue;
            }
            // Dotfiles (.env, .gitignore, .gitkeep, .env.example, etc.) follow
            // their own tooling-driven conventions.
            if (basename.startsWith('.')) {
                continue;
            }
            // Dockerfile / Dockerfile.<suffix> are the upstream convention.
            if (/^Dockerfile(\..+)?$/.test(basename)) {
                continue;
            }
            // React/Vite component convention is PascalCase for .jsx/.tsx/.js
            // component modules under ui/src/components or similar paths.
            if (/^[A-Z][A-Za-z0-9]*\.(jsx?|tsx?)$/.test(basename)) {
                continue;
            }
            // Generated coverage/build artifacts under tools/*/coverage are
            // out-of-tree by convention and should not be governed by content
            // naming rules. Skip if any path segment is "coverage".
            const relSegments = path.relative(repoRoot, filePath).split(path.sep);
            if (relSegments.includes('coverage') || relSegments.includes('dist') || relSegments.includes('node_modules')) {
                continue;
            }
            if (!slugPattern.test(basename)) {
                warn(`${path.relative(repoRoot, filePath)} violates slug-based naming convention`);
            }
        }
    }
}

function checkMcpConfigMapping() {
    // Decision [2026-06-19-0012] / [2026-06-12-0007]: verify entries in
    // mcp.config.json point at real files in mcp-protocols/ and skills/.
    const configPath = path.join(repoRoot, 'mcp.config.json');
    if (!fs.existsSync(configPath)) {
        return;
    }
    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        warn(`mcp.config.json is not valid JSON: ${error.message}`);
        return;
    }
    const activeMcps = Array.isArray(config.active_mcps) ? config.active_mcps : [];
    const activeSkills = Array.isArray(config.active_skills) ? config.active_skills : [];
    for (const mcp of activeMcps) {
        const candidate = path.join(repoRoot, 'mcp-protocols', `${mcp}.md`);
        if (!fs.existsSync(candidate)) {
            warn(`mcp.config.json active_mcps entry has no matching file: mcp-protocols/${mcp}.md`);
        }
    }
    for (const skill of activeSkills) {
        const candidate = path.join(repoRoot, 'skills', `${skill}.md`);
        if (!fs.existsSync(candidate)) {
            warn(`mcp.config.json active_skills entry has no matching file: skills/${skill}.md`);
        }
    }
}

function main() {
    checkTemplates();
    checkPersonas();
    checkSkills();
    checkGeneratedOutputs();

    // Supplementary (warning-only) audits per Decision [2026-06-19-0012].
    console.log('Running supplementary audits (warning-only)...');
    checkNodeBaseline();
    checkAiModelBaseline();
    checkNamingConvention();
    checkMcpConfigMapping();

    if (failed) {
        process.exit(1);
    }

    console.log('Repository audit passed.');
}

main();
