#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../GEMINI.template.md');
const outputPath = path.join(__dirname, '../GEMINI.md');
const configPath = path.join(__dirname, '../mcp.config.json');
const protocolsDir = path.join(__dirname, '../mcp-protocols');
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

    // 3. Read the config to see which MCPs to enable
    let activeMcps = [];
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            activeMcps = config.active_mcps || [];
            if (!Array.isArray(activeMcps)) {
                console.error('Error: active_mcps in mcp.config.json must be an array.');
                process.exit(1);
            }
        } catch (err) {
            console.error('Error parsing mcp.config.json:', err.message);
            process.exit(1);
        }
    } else {
        console.warn('Warning: mcp.config.json not found. Generating without specific MCP integrations.');
    }

    // 4. Gather MCP contents
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

    // 5. Replace the target tags in the template
    const mcpStartTag = '<!-- MCP_INJECTIONS_START -->';
    const mcpEndTag = '<!-- MCP_INJECTIONS_END -->';
    
    let finalContent = templateContent;

    // Inject Global Mandates before the MCP injections
    if (globalMandates) {
        finalContent = finalContent.replace(mcpStartTag, `${globalMandates}\n${mcpStartTag}`);
    }

    const mcpStartIndex = finalContent.indexOf(mcpStartTag);
    const mcpEndIndex = finalContent.indexOf(mcpEndTag);
    
    if (mcpStartIndex !== -1 && mcpEndIndex !== -1) {
        const pre = finalContent.substring(0, mcpStartIndex + mcpStartTag.length);
        const post = finalContent.substring(mcpEndIndex);
        
        finalContent = `${pre}\n${injectedContent}\n${post}`;
        
        fs.writeFileSync(outputPath, finalContent, 'utf8');
        console.log(`Successfully generated GEMINI.md with active integrations: ${activeMcps.join(', ') || 'None'}`);
    } else {
        console.error('Error: Injection markers (<!-- MCP_INJECTIONS_START --> and <!-- MCP_INJECTIONS_END -->) not found in GEMINI.template.md');
        process.exit(1);
    }
}

run();