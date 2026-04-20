#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    buildAgentIndex,
    buildGlobalMandates,
    buildMcpSection,
    buildSkillsSection,
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

    if (!success) {
        process.exit(1);
    }
}

run();
