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

    // 2. Read the config to see which MCPs to enable
    let activeMcps = [];
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            activeMcps = config.active_mcps || [];
        } catch (err) {
            console.error('Error parsing mcp.config.json:', err.message);
            process.exit(1);
        }
    } else {
        console.warn('Warning: mcp.config.json not found. Generating without specific MCP integrations.');
    }

    // 3. Gather MCP contents
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

    // 4. Replace the target tag in the template
    const startTag = '<!-- MCP_INJECTIONS_START -->';
    const endTag = '<!-- MCP_INJECTIONS_END -->';
    
    const startIndex = templateContent.indexOf(startTag);
    const endIndex = templateContent.indexOf(endTag);
    
    if (startIndex !== -1 && endIndex !== -1) {
        const pre = templateContent.substring(0, startIndex + startTag.length);
        const post = templateContent.substring(endIndex);
        
        const finalContent = `${pre}\n${injectedContent}\n${post}`;
        
        let finalOutput = finalContent;

        // 5. Inject AGENTS.md content
        const agentsStartTag = '<!-- AGENTS_INJECTIONS_START -->';
        const agentsEndTag = '<!-- AGENTS_INJECTIONS_END -->';

        const agentsStartIndex = finalOutput.indexOf(agentsStartTag);
        const agentsEndIndex = finalOutput.indexOf(agentsEndTag);

        if (agentsStartIndex !== -1 && agentsEndIndex !== -1) {
            let agentsContent = '';
            if (fs.existsSync(agentsMdPath)) {
                agentsContent = fs.readFileSync(agentsMdPath, 'utf8');
            } else {
                console.warn('Warning: AGENTS.md not found.');
                agentsContent = '> ⚠️ AGENTS.md missing.\n';
            }

            const preAgents = finalOutput.substring(0, agentsStartIndex + agentsStartTag.length);
            const postAgents = finalOutput.substring(agentsEndIndex);
            finalOutput = `${preAgents}\n${agentsContent}\n${postAgents}`;
        }

        fs.writeFileSync(outputPath, finalOutput, 'utf8');
        console.log(`Successfully generated GEMINI.md with active integrations: ${activeMcps.join(', ') || 'None'}`);
    } else {
        console.error('Error: Injection markers (<!-- MCP_INJECTIONS_START --> and <!-- MCP_INJECTIONS_END -->) not found in GEMINI.template.md');
        process.exit(1);
    }
}

run();