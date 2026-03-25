#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../GEMINI.template.md');
const outputPath = path.join(__dirname, '../GEMINI.md');
const configPath = path.join(__dirname, '../mcp.config.json');
const protocolsDir = path.join(__dirname, '../mcp-protocols');
const skillsDir = path.join(__dirname, '../skills');
const agentsMdPath = path.join(__dirname, '../AGENTS.md');

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

    // 3. Read the config to see which MCPs and skills to enable
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

    // Inject Global Mandates before MCP injections (preserves existing behavior)
    if (globalMandates) {
        finalContent = finalContent.replace('<!-- MCP_INJECTIONS_START -->', `${globalMandates}\n<!-- MCP_INJECTIONS_START -->`);
    }

    // Inject Skills
    finalContent = injectBetween(finalContent, '<!-- SKILLS_INJECTIONS_START -->', '<!-- SKILLS_INJECTIONS_END -->', skillsContent);

    // Inject MCPs
    const mcpStartTag = '<!-- MCP_INJECTIONS_START -->';
    const mcpEndTag = '<!-- MCP_INJECTIONS_END -->';
    if (finalContent.includes(mcpStartTag) && finalContent.includes(mcpEndTag)) {
        finalContent = injectBetween(finalContent, mcpStartTag, mcpEndTag, injectedContent);
        fs.writeFileSync(outputPath, finalContent, 'utf8');
        console.log(`Successfully generated GEMINI.md with ${activeSkills.length} skills and ${activeMcps.length} MCPs.`);
    } else {
        console.error('Error: MCP injection markers not found in GEMINI.template.md');
        process.exit(1);
    }
}

run();