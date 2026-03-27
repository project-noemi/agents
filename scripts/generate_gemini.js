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

            // Extract Role section (first paragraph after ## Role)
            const roleMatch = content.match(/## Role\s*\n([\s\S]*?)(?=\n## |\n$)/);
            const role = roleMatch ? roleMatch[1].trim().split('\n')[0] : '';

            agents.push({
                path: `agents/${relativePath}`,
                title,
                role: role.substring(0, 200), // Truncate to keep index concise
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

    // 2. Read AGENTS.md for Global Security Mandates and Directives
    let globalMandates = '';
    if (fs.existsSync(agentsMdPath)) {
        console.log('Injecting global security mandates from AGENTS.md...');
        const agentsMdContent = fs.readFileSync(agentsMdPath, 'utf8');

        // Extract "Mandatory Security Rules" and "Mandatory Directives"
        const securityRulesMatch = agentsMdContent.match(/# 🔐 Secrets & Configuration([\s\S]*?)(?=# 🛡|$)/);
        const directivesMatch = agentsMdContent.match(/# 🛡 Error Handling and Resilience([\s\S]*?)(?=# 🚀|$)/);

        if (securityRulesMatch) {
            globalMandates += `\n## 🔐 Global Security Mandates\n${securityRulesMatch[1].trim()}\n`;
        } else {
            console.warn('Warning: "Secrets & Configuration" section not found in AGENTS.md — security mandates will not be injected.');
        }
        if (directivesMatch) {
            globalMandates += `\n## 🛡 Global Resilience Directives\n${directivesMatch[1].trim()}\n`;
        } else {
            console.warn('Warning: "Error Handling and Resilience" section not found in AGENTS.md — resilience directives will not be injected.');
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

        agentIndex = '\n## 🗂️ Agent Index\n\n';
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
            if (!Array.isArray(activeMcps)) {
                console.error('Error: active_mcps in mcp.config.json must be an array.');
                process.exit(1);
            }
            if (!Array.isArray(activeSkills)) {
                console.error('Error: active_skills in mcp.config.json must be an array.');
                process.exit(1);
            }
        } catch (err) {
            console.error('Error parsing mcp.config.json:', err.message);
            process.exit(1);
        }
    } else {
        console.warn('Warning: mcp.config.json not found. Generating without specific MCP integrations or skills.');
    }

    // 4. Gather Skill contents
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

    // 5. Gather MCP contents
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

    // 6. Replace all injection zones in the template
    let finalContent = templateContent;

    // Helper to inject content between start/end markers
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

    // Inject Global Mandates
    finalContent = injectBetween(finalContent, '<!-- GLOBAL_MANDATES_START -->', '<!-- GLOBAL_MANDATES_END -->', globalMandates);

    // Inject Agent Index
    finalContent = injectBetween(finalContent, '<!-- AGENT_INDEX_START -->', '<!-- AGENT_INDEX_END -->', agentIndex);

    // Inject Skills
    finalContent = injectBetween(finalContent, '<!-- SKILLS_INJECTIONS_START -->', '<!-- SKILLS_INJECTIONS_END -->', skillsContent);

    // Inject MCPs
    if (finalContent.includes('<!-- MCP_INJECTIONS_START -->') && finalContent.includes('<!-- MCP_INJECTIONS_END -->')) {
        finalContent = injectBetween(finalContent, '<!-- MCP_INJECTIONS_START -->', '<!-- MCP_INJECTIONS_END -->', injectedContent);
    } else {
        console.error('Error: MCP injection markers not found in GEMINI.template.md');
        process.exit(1);
    }

    fs.writeFileSync(outputPath, finalContent, 'utf8');
    console.log(`Successfully generated GEMINI.md with ${agents.length} agents, ${activeSkills.length} skills, and ${activeMcps.length} MCPs.`);
}

run();