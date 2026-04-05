#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../GEMINI.template.md');
const outputPath = path.join(__dirname, '../GEMINI.md');
const configPath = path.join(__dirname, '../mcp.config.json');
const protocolsDir = path.join(__dirname, '../mcp-protocols');
const skillsDir = path.join(__dirname, '../skills');
const agentsMdPath = path.join(__dirname, '../AGENTS.md');
const agentsDir = path.join(__dirname, '../agents');

function discoverAgents(baseDir, prefix = '') {
    const agents = [];
    if (!fs.existsSync(baseDir)) return agents;

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(baseDir, entry.name);
        if (entry.isDirectory()) {
            agents.push(...discoverAgents(fullPath, path.join(prefix, entry.name)));
        } else if (entry.name.endsWith('.md')) {
            const relativePath = path.join(prefix, entry.name);
            const content = fs.readFileSync(fullPath, 'utf8');

            // Extract H1 title (# Name — Domain Agent)
            const titleMatch = content.match(/^#\s+(.+)/m);
            const title = titleMatch ? titleMatch[1].trim() : entry.name.replace('.md', '');

            agents.push({
                path: `agents/${relativePath}`,
                title,
                domain: prefix.split(path.sep)[0] || 'root'
            });
        }
    }
    return agents;
}

function run() {
    console.log('Generating modular GEMINI.md...');

    // 1. Read the base template
    if (!fs.existsSync(templatePath)) {
        console.error('Error: GEMINI.template.md not found.');
        process.exit(1);
    }
    let templateContent = fs.readFileSync(templatePath, 'utf8');

    // 2. Read AGENTS.md for Global Mandates (injecting all H1 sections)
    let globalMandates = '';
    if (fs.existsSync(agentsMdPath)) {
        console.log('Injecting global mandates from AGENTS.md...');
        const agentsMdContent = fs.readFileSync(agentsMdPath, 'utf8');
        
        // Split by H1 headers
        const sections = agentsMdContent.split(/^#\s+/m);
        for (const section of sections) {
            if (!section.trim()) continue;
            const lines = section.split('\n');
            const title = lines[0].trim();
            const body = lines.slice(1).join('\n').trim();
            globalMandates += `\n## ${title}\n${body}\n`;
        }
    }

    // 3. Discover all agent specs and build an index
    console.log('Discovering agent specifications...');
    const agents = discoverAgents(agentsDir);
    let agentIndex = '';
    if (agents.length > 0) {
        // Group by domain
        const byDomain = {};
        for (const agent of agents) {
            if (!byDomain[agent.domain]) byDomain[agent.domain] = [];
            byDomain[agent.domain].push(agent);
        }

        agentIndex = '\n## Agent Index\n\n';
        agentIndex += `${agents.length} agent specifications across ${Object.keys(byDomain).length} domains:\n\n`;
        agentIndex += '| Domain | Agent | Spec File |\n';
        agentIndex += '|--------|-------|-----------|\n';

        const sortedDomains = Object.keys(byDomain).sort();
        for (const domain of sortedDomains) {
            for (const agent of byDomain[domain]) {
                agentIndex += `| ${domain} | ${agent.title} | \`${agent.path}\` |\n`;
            }
        }
        agentIndex += '\nRead the relevant agent spec before performing domain-specific tasks.\n';

        console.log(`Indexed ${agents.length} agents across ${Object.keys(byDomain).length} domains.`);
    }

    // 4. Read the config to see which MCPs and skills to enable
    let activeMcps = [];
    let activeSkills = [];
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            activeMcps = config.active_mcps || [];
            activeSkills = config.active_skills || [];
        } catch (err) {
            console.error('Error parsing mcp.config.json:', err.message);
            process.exit(1);
        }
    }

    // 5. Gather Skill contents
    let skillsContent = '';
    if (activeSkills.length === 0) {
        skillsContent = '<!-- No active skills configured in mcp.config.json -->\n';
    } else {
        for (const skill of activeSkills) {
            const skillFile = path.join(skillsDir, `${skill}.md`);
            if (fs.existsSync(skillFile)) {
                console.log(`Injecting skill: ${skill}`);
                const content = fs.readFileSync(skillFile, 'utf8');
                skillsContent += `\n${content}\n`;
            } else {
                console.warn(`Warning: Skill file not found -> ${skillFile}`);
                skillsContent += `\n### ${skill}\n\n> Warning: Skill file missing — skills/${skill}.md\n\n`;
            }
        }
    }

    // 6. Gather MCP contents
    let injectedContent = '';
    if (activeMcps.length === 0) {
        injectedContent = '<!-- No active MCPs configured in mcp.config.json -->\n';
    } else {
        for (const mcp of activeMcps) {
            const mcpFile = path.join(protocolsDir, `${mcp}.md`);
            if (fs.existsSync(mcpFile)) {
                console.log(`Injecting module: ${mcp}`);
                const content = fs.readFileSync(mcpFile, 'utf8');
                injectedContent += `\n### 🔹 ${mcp.toUpperCase()} Protocol\n\n${content}\n`;
            } else {
                console.warn(`Warning: Module file not found for active MCP -> ${mcpFile}`);
                injectedContent += `\n### 🔹 ${mcp.toUpperCase()} Protocol\n\n> ⚠️ File missing: mcp-protocols/${mcp}.md\n\n`;
            }
        }
    }

    // 7. Replace all injection zones in the template
    let finalContent = templateContent;

    function injectBetween(content, startTag, endTag, payload) {
        const startIdx = content.indexOf(startTag);
        const endIdx = content.indexOf(endTag);
        if (startIdx !== -1 && endIdx !== -1) {
            const pre = content.substring(0, startIdx + startTag.length);
            const post = content.substring(endIdx);
            return `${pre}\n${payload}\n${post}`;
        }
        return content;
    }

    finalContent = injectBetween(finalContent, '<!-- GLOBAL_MANDATES_START -->', '<!-- GLOBAL_MANDATES_END -->', globalMandates);
    finalContent = injectBetween(finalContent, '<!-- AGENT_INDEX_START -->', '<!-- AGENT_INDEX_END -->', agentIndex);
    finalContent = injectBetween(finalContent, '<!-- SKILLS_INJECTIONS_START -->', '<!-- SKILLS_INJECTIONS_END -->', skillsContent);
    finalContent = injectBetween(finalContent, '<!-- MCP_INJECTIONS_START -->', '<!-- MCP_INJECTIONS_END -->', injectedContent);

    fs.writeFileSync(outputPath, finalContent, 'utf8');
    console.log(`Successfully generated GEMINI.md with ${agents.length} agents, ${activeSkills.length} skills, and ${activeMcps.length} MCPs.`);
}

run();
