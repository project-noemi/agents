#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    CONTEXT_POINTER,
    buildSkillsDist,
    discoverAgents,
    parseCliArgs,
    readConfig
} = require('./context_helpers');
const { buildContextFile, LAYERS_ENV } = require('./context_layers');

const defaultConfigPath = path.join(__dirname, '../mcp.config.json');
const agentsMdPath = path.join(__dirname, '../AGENTS.md');
const agentsDir = path.join(__dirname, '../agents');
const skillsDir = path.join(__dirname, '../skills');

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

/**
 * CLAUDE.md / GEMINI.md = the `@AGENTS.md` pointer, plus a marked block of
 * explicit `@path` imports for the configuration layers that resolve on this
 * checkout (AGENTS.layers or NOEMI_ORG_LAYERS, then AGENTS.local.md; missing
 * files skipped). With no layers present the output is exactly the pointer.
 * See scripts/context_layers.js and docs/configuration-layers.md.
 */
function resolveContext() {
    const { content, resolved } = buildContextFile({ repoRoot, env: process.env, pointer: CONTEXT_POINTER });
    if (resolved.source !== 'none') {
        console.log(`Configuration layers from ${resolved.source}: ${resolved.present.length} present`
            + (resolved.missing.length ? `, ${resolved.missing.length} missing (skipped: ${resolved.missing.join(', ')})` : '')
            + '.');
    }
    if (resolved.source === LAYERS_ENV) {
        console.warn(`  ${LAYERS_ENV} is set: do not commit CLAUDE.md/GEMINI.md generated from a session override.`);
    }
    if (resolved.local) {
        console.warn('  AGENTS.local.md is present: CLAUDE.md/GEMINI.md now import it. Do not commit that line.');
    }
    return content;
}

function generate(target, content) {
    console.log(`Generating ${target.name}.md as an AGENTS.md pointer...`);
    try {
        fs.writeFileSync(target.output, content, 'utf8');
        console.log(`Successfully generated ${target.output} (${JSON.stringify(content.trim())}).`);
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
            const walk = (dir) => {
                for (const inner of fs.readdirSync(dir, { withFileTypes: true })) {
                    const innerPath = path.join(dir, inner.name);
                    const rel = path.relative(repoRoot, innerPath);
                    if (inner.isDirectory()) {
                        walk(innerPath);
                        if (fs.existsSync(innerPath) && fs.readdirSync(innerPath).length === 0) {
                            fs.rmSync(innerPath, { recursive: true, force: true });
                        }
                        continue;
                    }
                    if (!expected.has(rel)) {
                        fs.rmSync(innerPath, { force: true });
                        console.log(`  pruned stray ${rel}`);
                    }
                }
            };
            walk(entryPath);
        }
    }

    const skillCount = files.filter((file) => path.basename(file.relPath) === 'SKILL.md').length;
    console.log(`Successfully generated skills-dist/ with ${skillCount} SKILL.md file(s)`
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

    let contextContent;
    try {
        contextContent = resolveContext();
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }

    let success = true;
    for (const target of TARGETS) {
        if (!generate(target, contextContent)) {
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
