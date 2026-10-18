#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    REQUIRED_AGENT_SECTIONS,
    REQUIRED_GLOBAL_SECTIONS,
    CONTEXT_POINTER,
    discoverAgents,
    extractAgentHeadings,
    extractTopLevelSections,
    findPlaceholderViolations,
    buildSkillsDist
} = require('./context_helpers');
const { auditConfigLayers, buildContextFile } = require('./context_layers');
const { buildComplianceReport, evaluateLayerCompliance, todayIso } = require('./layer_compliance');

const repoRoot = path.join(__dirname, '..');
const agentsDir = path.join(repoRoot, 'agents');
const skillsDir = path.join(repoRoot, 'skills');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');

const REQUIRED_ENGAGEMENT_SECTIONS = [
    'Engagement Metadata',
    'Purpose',
    'Contribution Deltas',
    'Mainline-Parity Controls',
    'What Does Not Change',
    'Exit Criteria',
    'Audit Notes'
];

// Compliance levels (docs/configuration-layers.md § Compliance): every check
// records PASS / WARN / FAIL findings. FAIL exits 1. WARN exits 0 unless
// --fail-on-warn or COMPLIANCE_FAIL_ON_WARN=1, then exits 2. The report opens
// with a one-line summary; --json prints a machine-readable report instead and
// --json-file=<path> writes one alongside the text report.
const findings = [];
const logLines = [];
const pendingStderr = [];
let currentCheck = 'setup';

function log(message) {
    logLines.push(message);
}

function record(level, message, extra = {}) {
    findings.push({ level, check: currentCheck, message, ...extra });
}

function fail(message, extra) {
    record('FAIL', message, extra);
    pendingStderr.push(`AUDIT FAIL: ${message}`);
}

function warn(message, extra) {
    record('WARN', message, extra);
    pendingStderr.push(`AUDIT WARN: ${message}`);
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
        if (content !== CONTEXT_POINTER) {
            fail(`${path.relative(repoRoot, templatePath)} must be exactly ${JSON.stringify(CONTEXT_POINTER)} (Decision [2026-09-22-0001]).`);
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

    // Substantive Compliance (CLAUDE.md · Coding Standards, Decision [2026-08-18-0002]):
    // mandatory sections must carry substantive, role-specific content; placeholder
    // markers in them fail the audit. Templates are exempt by construction — skill
    // discovery skips SKILL_TEMPLATE.md and docs/AGENT_TEMPLATE.md is never audited.
    for (const violation of findPlaceholderViolations(content, requiredSections)) {
        fail(`${relativePath} '${violation.section}' contains placeholder content ('${violation.marker}') — mandatory sections must be substantive (Substantive Compliance).`);
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
    log('Auditing agent specifications...');
    const agents = discoverAgents(agentsDir);
    for (const agent of agents) {
        const fullPath = path.join(repoRoot, agent.path);
        
        // Ensure Role exists for our enhanced index
        if (!agent.role) {
            fail(`${agent.path} is missing a '## Role' section (required for the Agent Index).`);
        }

        auditFile(fullPath, REQUIRED_AGENT_SECTIONS);
    }
    log(`Audited ${agents.length} agents.`);
}

function checkSkills() {
    log('Auditing reusable skills...');
    if (!fs.existsSync(skillsDir)) {
        log('Skills directory not found, skipping skills audit.');
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
    log(`Audited ${skillFiles.length} skills.`);
}

function checkGeneratedOutputs() {
    // Expected content = the `@AGENTS.md` pointer plus, only when configuration
    // layers resolve on this checkout, the generated layer import block
    // (scripts/context_layers.js). Upstream ships no live layers, so here the
    // expectation is still exactly CONTEXT_POINTER (Decision [2026-09-22-0001]).
    let expected;
    try {
        expected = buildContextFile({ repoRoot, env: process.env, pointer: CONTEXT_POINTER }).content;
    } catch (error) {
        fail(error.message);
        return;
    }
    for (const outputPath of generatedOutputs) {
        if (!fs.existsSync(outputPath)) {
            fail(`${path.basename(outputPath)} is missing — run \`npm run generate\`.`);
            continue;
        }
        const content = fs.readFileSync(outputPath, 'utf8');
        if (content !== expected) {
            fail(`${path.basename(outputPath)} must be exactly ${JSON.stringify(expected)} (Decision [2026-09-22-0001]; configuration layers per docs/configuration-layers.md) — run \`npm run generate\`.`);
        }
    }
}

// Configuration layers hook (docs/configuration-layers.md): the AGENTS.md
// section exists and is last, the org/example template exists, AGENTS.local.md
// is gitignored, and every path in AGENTS.layers / AGENTS.layers.example is
// well-formed. Missing optional layer files are deliberately NOT a failure.
function checkConfigLayers() {
    log('Auditing configuration layers hook (AGENTS.layers)...');
    for (const message of auditConfigLayers(repoRoot)) {
        fail(message);
    }
}

// Layer compliance: layers may override any baseline rule (later wins), so
// this check REPORTS loosened rules instead of blocking them. Severity depends
// on what was loosened: an unwaived core (secrets.* / refusal.*) relaxation is
// FAIL, a waived one or a preference relaxation is WARN, a clarification is
// PASS. See scripts/layer_compliance.js.
let waiverReport = [];
function checkLayerCompliance() {
    log('Auditing layer compliance (rule IDs, overrides, waivers)...');
    const result = evaluateLayerCompliance({ repoRoot, env: process.env, today: todayIso() });
    waiverReport = result.waivers;
    log(`Active layers: ${result.layers.length ? result.layers.join(' -> ') : 'none (baseline only)'}.`);
    for (const finding of result.findings) {
        const { level, message, check, ...extra } = finding;
        if (level === 'FAIL') {
            fail(message, extra);
        } else if (level === 'WARN') {
            warn(message, extra);
        } else {
            record('PASS', message, extra);
        }
    }
}

// Licensing posture consistency check — resolves Clarification [2026-07-11] Licensing
// Posture Missing from the Requirements Contract (Decision [2026-07-13-0002]).
// Verifies that the FSL-1.1-Apache-2.0 declaration in LICENSE and the SPDX identifier
// in package.json stay aligned, and that the Transparent Source Guarantee doc is present.
const CANONICAL_LICENSE_ID = 'FSL-1.1-Apache-2.0';
const CANONICAL_LICENSE_HEADER = 'Functional Source License, Version 1.1, Apache 2.0 Future License';

// Machine-identity PR authorship lives in mcp-protocols/github.md. After
// Decision [2026-09-22-0001], CLAUDE.md/GEMINI.md only point at AGENTS.md, so
// the always-loaded contract is the pointer in AGENTS.md — not a pasted body.
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
    const agentsMd = fs.readFileSync(agentsMdPath, 'utf8');
    if (!agentsMd.includes('mcp-protocols/github.md')) {
        fail('AGENTS.md must point at mcp-protocols/github.md so machine-identity PR authorship stays on the load path after CLAUDE.md/GEMINI.md became pointers.');
    }
}

// skills-dist/ is an immutable build artifact: byte-determined by skills/ +
// AGENTS.md via the same builder generate_all.js uses. Re-running the builder
// in memory and demanding byte equality makes manual edits, stale files, and
// missing artifacts all loud (Decision: skills.sh Phase 1 distribution).
function checkSkillsDistDeterminism() {
    log('Auditing skills-dist build artifacts (determinism)...');

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

    const expectedByRel = new Map(expected.files.map((file) => [file.relPath, file.content]));

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
    log('Auditing Phase 0 Assessment Kit inventory...');
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

function checkBibleEdition() {
    log('Auditing Bible edition stamp (CalVer, not SemVer)...');
    const { checkBibleEditionFile } = require('./bible-edition');
    for (const error of checkBibleEditionFile(repoRoot)) {
        fail(error);
    }
}

function checkMergeGateInvariant() {
    log('Auditing merge-gate invariant (develop is the only PR source into main)...');
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

function checkBranchModel() {
    log('Auditing branch model (PR targets and registered integration branches)...');
    const { loadBranchModel, validateModel, activeIntegrationBranches } = require('./branch-model');

    let model;
    try {
        model = loadBranchModel();
    } catch (error) {
        fail(`docs/branch-model.json could not be read: ${error.message}`);
        return;
    }

    for (const error of validateModel(model)) {
        fail(`docs/branch-model.json: ${error}`);
    }

    const validatePath = path.join(repoRoot, '.github/workflows/validate.yml');
    const validateContent = fs.existsSync(validatePath) ? fs.readFileSync(validatePath, 'utf8') : '';
    const targetGatePath = path.join(repoRoot, '.github/workflows/require-valid-pr-target.yml');
    if (!fs.existsSync(targetGatePath)) {
        fail('.github/workflows/require-valid-pr-target.yml is missing; the branch model is declared but nothing enforces it.');
    }

    const today = new Date().toISOString().slice(0, 10);

    for (const entry of activeIntegrationBranches(model)) {
        // An active integration branch is governed as a mainline. Its profile is
        // the human contract; these are the machine-checkable halves.
        const profilePath = path.join(repoRoot, 'engagements', `${entry.engagement}.md`);
        if (!fs.existsSync(profilePath)) {
            fail(`Integration branch "${entry.branch}" names engagement "${entry.engagement}", but engagements/${entry.engagement}.md does not exist.`);
        } else {
            const profile = fs.readFileSync(profilePath, 'utf8');
            if (!profile.includes(entry.branch)) {
                fail(`engagements/${entry.engagement}.md does not name its own integration branch "${entry.branch}".`);
            }
            for (const section of REQUIRED_ENGAGEMENT_SECTIONS) {
                if (!new RegExp(`^##\\s+${section}\\s*$`, 'mi').test(profile)) {
                    fail(`engagements/${entry.engagement}.md is missing the required "${section}" section.`);
                }
            }
        }

        if (!validateContent.includes(entry.branch)) {
            fail(`Integration branch "${entry.branch}" is registered active but absent from .github/workflows/validate.yml; it would carry no validation gate.`);
        }

        if (entry.endsOn && entry.endsOn < today) {
            fail(`Engagement "${entry.engagement}" ended on ${entry.endsOn} but is still registered active. Close it in docs/branch-model.json.`);
        }
    }
}

const CHECKS = [
    checkTemplates,
    checkInlineSafetyContract,
    checkPersonas,
    checkSkills,
    checkGeneratedOutputs,
    checkConfigLayers,
    checkLayerCompliance,
    checkSkillsDistDeterminism,
    checkLicensingPosture,
    checkPhaseZeroKit,
    checkMergeGateInvariant,
    checkBranchModel,
    checkBibleEdition
];

function parseArgs(argv) {
    const options = { json: false, jsonFile: null, failOnWarn: process.env.COMPLIANCE_FAIL_ON_WARN === '1' };
    for (const arg of argv) {
        if (arg === '--json') {
            options.json = true;
        } else if (arg.startsWith('--json-file=')) {
            options.jsonFile = arg.slice('--json-file='.length);
        } else if (arg === '--fail-on-warn') {
            options.failOnWarn = true;
        } else {
            console.error(`Unknown argument: ${arg} (supported: --json, --json-file=<path>, --fail-on-warn)`);
            process.exit(64);
        }
    }
    return options;
}

function annotate(level, message) {
    if (process.env.GITHUB_ACTIONS !== 'true') {
        return;
    }
    const escaped = String(message).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::${level === 'FAIL' ? 'error' : 'warning'} title=Compliance ${level}::${escaped}`);
}

function main() {
    const options = parseArgs(process.argv.slice(2));

    for (const check of CHECKS) {
        currentCheck = check.name;
        try {
            check();
        } catch (error) {
            fail(`${check.name} crashed: ${error.message}`);
        }
    }
    currentCheck = 'report';

    const report = buildComplianceReport({
        checkNames: CHECKS.map((check) => check.name),
        findings,
        waivers: waiverReport,
        failOnWarn: options.failOnWarn
    });
    const { checks, status, exitCode, summary: summaryLine } = report;

    if (options.jsonFile) {
        fs.mkdirSync(path.dirname(path.resolve(options.jsonFile)), { recursive: true });
        fs.writeFileSync(options.jsonFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    if (options.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        process.exit(exitCode);
    }

    // Summary first, then the per-finding stderr lines (kept for log scrapers
    // and annotations), then the full report.
    console.log(summaryLine);
    for (const line of pendingStderr) {
        console.error(line);
    }

    const out = [''];
    for (const level of ['FAIL', 'WARN']) {
        const items = findings.filter((finding) => finding.level === level);
        out.push(`${level} (${items.length})`);
        for (const item of items) {
            out.push(`  - [${item.check}] ${item.message}`);
            annotate(level, item.message);
        }
        out.push('');
    }
    out.push(`Waivers (${waiverReport.length})`);
    for (const waiver of waiverReport) {
        out.push(`  - ${waiver.rule}${waiver.layer ? ` @ ${waiver.layer}` : ''}: ${waiver.status}${waiver.used ? ', in use' : ', unused'}`
            + ` | owner: ${waiver.owner} | expires: ${waiver.expires || 'never'} | reason: ${waiver.reason}`);
    }
    out.push('');
    const passes = findings.filter((finding) => finding.level === 'PASS');
    if (passes.length) {
        out.push(`Clarifications / tightenings (${passes.length})`);
        for (const item of passes) {
            out.push(`  - ${item.message}`);
        }
        out.push('');
    }
    out.push('Checks');
    for (const check of checks) {
        out.push(`  ${check.level.padEnd(4)} ${check.name}`);
    }
    out.push('', 'Details', ...logLines.map((line) => `  ${line}`), '');
    if (exitCode === 0) {
        out.push(status === 'PASS' ? 'Repository audit passed.' : 'Repository audit passed with warnings (use --fail-on-warn or COMPLIANCE_FAIL_ON_WARN=1 to block).');
    } else if (exitCode === 2) {
        out.push('Repository audit: WARN treated as failure (--fail-on-warn / COMPLIANCE_FAIL_ON_WARN=1).');
    }
    console.log(out.join('\n'));
    process.exit(exitCode);
}

if (require.main === module) {
    main();
}
