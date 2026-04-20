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

const templatePath = path.join(__dirname, '../templates/context/GEMINI.template.md');
const outputPath = path.join(__dirname, '../GEMINI.md');
const defaultConfigPath = path.join(__dirname, '../mcp.config.json');
const protocolsDir = path.join(__dirname, '../mcp-protocols');
const skillsDir = path.join(__dirname, '../skills');
const agentsMdPath = path.join(__dirname, '../AGENTS.md');
const agentsDir = path.join(__dirname, '../agents');

function run() {
    console.log('Generating modular GEMINI.md...');
    const { configOverride } = parseCliArgs(process.argv.slice(2));

    if (!fs.existsSync(templatePath)) {
        console.error('Error: templates/context/GEMINI.template.md not found.');
        process.exit(1);
    }
    const templateContent = fs.readFileSync(templatePath, 'utf8');

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

    let finalContent = templateContent;
    finalContent = injectBetween(finalContent, '<!-- GLOBAL_MANDATES_START -->', '<!-- GLOBAL_MANDATES_END -->', buildGlobalMandates(agentsMdPath));
    finalContent = injectBetween(finalContent, '<!-- AGENT_INDEX_START -->', '<!-- AGENT_INDEX_END -->', buildAgentIndex(agents));
    finalContent = injectBetween(finalContent, '<!-- SKILLS_INJECTIONS_START -->', '<!-- SKILLS_INJECTIONS_END -->', buildSkillsSection(config.activeSkills, skillsDir));
    finalContent = injectBetween(finalContent, '<!-- MCP_INJECTIONS_START -->', '<!-- MCP_INJECTIONS_END -->', buildMcpSection(config.activeMcps, protocolsDir));

    fs.writeFileSync(outputPath, finalContent, 'utf8');
    console.log(`Successfully generated GEMINI.md with ${agents.length} agents, ${config.activeSkills.length} skills, and ${config.activeMcps.length} MCPs.`);
}

run();
