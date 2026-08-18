#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    buildAgentIndex,
    buildFrameworkSection,
    buildGlobalMandates,
    buildMcpSection,
    buildSkillsSection,
    buildSkillsDist,
    discoverAgents,
    injectBetween,
    parseCliArgs,
    readConfig
} = require('./context_helpers');

const defaultConfigPath = path.join(__dirname, '../mcp.config.json');
const protocolsDir = path.join(__dirname, '../mcp-protocols');
const skillsDir = path.join(__dirname, '../skills');
const agentsMdPath = path.join(__dirname, '../AGENTS.md');
const agentsDir = path.join(__dirname, '../agents');
const valueLensesDir = path.join(__dirname, '../value-lenses');
const operatingProfilesDir = path.join(__dirname, '../operating-profiles');

const repoRoot = path.join(__dirname, '..');
const skillsDistDir = path.join(repoRoot, 'skills-dist');

const TARGETS = [
    {
        name: 'GEMINI',
        template: path.join(__dirname, '../templates/context/GEMINI.template.md'),
        output: path.join(__dirname, '../GEMINI.md')
    },
    {
        name: 'CLAUDE',
        template: path.join(__dirname, '../templates/context/CLAUDE.template.md'),
        output: path.join(__dirname, '../CLAUDE.md')
    }
];

function generate(target, config, agents) {
    console.log(`Generating modular ${target.name}.md...`);

    if (!fs.existsSync(target.template)) {
        console.error(`Error: Template not found -> ${target.template}`);
        return false;
    }

    const templateContent = fs.readFileSync(target.template, 'utf8');
    let finalContent = templateContent;

    try {
        finalContent = injectBetween(finalContent, '<!-- GLOBAL_MANDATES_START -->', '<!-- GLOBAL_MANDATES_END -->', buildGlobalMandates(agentsMdPath));
        finalContent = injectBetween(finalContent, '<!-- AGENT_INDEX_START -->', '<!-- AGENT_INDEX_END -->', buildAgentIndex(agents));
        finalContent = injectBetween(
            finalContent,
            '<!-- VALUE_LENS_INJECTIONS_START -->',
            '<!-- VALUE_LENS_INJECTIONS_END -->',
            buildFrameworkSection(
                valueLensesDir,
                'Value Lenses',
                'The following Value Lenses are part of the NoéMI framework layer. Agents should consult the lens that matches the engagement context (e.g., performance-efficiency, care-continuity) when making trade-off decisions.'
            )
        );
        finalContent = injectBetween(
            finalContent,
            '<!-- OPERATING_PROFILE_INJECTIONS_START -->',
            '<!-- OPERATING_PROFILE_INJECTIONS_END -->',
            buildFrameworkSection(
                operatingProfilesDir,
                'Operating Profiles',
                'The following Operating Profiles describe how agents should adapt their tone, cadence, and escalation behavior to different organizational contexts.',
                true
            )
        );
        finalContent = injectBetween(finalContent, '<!-- SKILLS_INJECTIONS_START -->', '<!-- SKILLS_INJECTIONS_END -->', buildSkillsSection(config.activeSkills, skillsDir));
        finalContent = injectBetween(finalContent, '<!-- MCP_INJECTIONS_START -->', '<!-- MCP_INJECTIONS_END -->', buildMcpSection(config.activeMcps, protocolsDir));

        fs.writeFileSync(target.output, finalContent, 'utf8');
        console.log(`Successfully generated ${target.output} with ${agents.length} agents, ${config.activeSkills.length} skills, and ${config.activeMcps.length} MCPs.`);
        return true;
    } catch (error) {
        console.error(`Error generating ${target.name}.md: ${error.message}`);
        return false;
    }
}

/**
 * skills-dist/<slug>/SKILL.md — the public skills.sh distribution surface
 * (Phase 1). Build artifacts, byte-determined by skills/ + AGENTS.md: written
 * here, verified byte-exact by scripts/audit-repo.js, never edited by hand.
 * Deliberately independent of mcp.config.json: ALL canonical skills publish,
 * not just the active set, so config-override runs cannot perturb the tree.
 */
function generateSkillsDist() {
    console.log('Generating skills-dist/ (public SKILL.md artifacts)...');
    const { files, withheld } = buildSkillsDist({ skillsDir, agentsMdPath, repoRoot });

    for (const held of withheld) {
        console.warn(`  WITHHELD from publication: ${held.sourceRelPath} — ${held.reason}`);
    }

    const expected = new Set(files.map((file) => file.relPath));
    for (const file of files) {
        const fullPath = path.join(repoRoot, file.relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, file.content, 'utf8');
    }

    // Prune anything the builder did not produce — renamed or removed skills
    // must not leave stale artifacts, and a stray file INSIDE a kept directory
    // is pruned too: the audit's error message promises that running this
    // generator fixes extra files, so the generator must actually deliver at
    // file granularity, not directory granularity (review finding).
    if (fs.existsSync(skillsDistDir)) {
        for (const entry of fs.readdirSync(skillsDistDir, { withFileTypes: true })) {
            const entryPath = path.join(skillsDistDir, entry.name);
            if (!entry.isDirectory()) {
                fs.rmSync(entryPath, { force: true });
                console.log(`  pruned stray skills-dist/${entry.name}`);
                continue;
            }
            const keep = expected.has(path.join('skills-dist', entry.name, 'SKILL.md'));
            if (!keep) {
                fs.rmSync(entryPath, { recursive: true, force: true });
                console.log(`  pruned stale skills-dist/${entry.name}/`);
                continue;
            }
            for (const inner of fs.readdirSync(entryPath, { withFileTypes: true })) {
                if (inner.name !== 'SKILL.md') {
                    fs.rmSync(path.join(entryPath, inner.name), { recursive: true, force: true });
                    console.log(`  pruned stray skills-dist/${entry.name}/${inner.name}`);
                }
            }
        }
    }

    console.log(`Successfully generated skills-dist/ with ${files.length} SKILL.md file(s)`
        + (withheld.length ? ` (${withheld.length} withheld pending substantive completion).` : '.'));
    return true;
}

function run() {
    const { configOverride } = parseCliArgs(process.argv.slice(2));

    console.log('Discovering agent specifications...');
    const agents = discoverAgents(agentsDir);
    console.log(`Indexed ${agents.length} agents.`);

    let config;
    try {
        config = readConfig(defaultConfigPath, configOverride);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }

    console.log(`Using config: ${config.config}`);

    let success = true;
    for (const target of TARGETS) {
        if (!generate(target, config, agents)) {
            success = false;
        }
    }

    try {
        generateSkillsDist();
    } catch (error) {
        console.error(`Error generating skills-dist/: ${error.message}`);
        success = false;
    }

    if (!success) {
        process.exit(1);
    }
}

run();
