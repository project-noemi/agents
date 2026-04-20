const fs = require('fs');
const path = require('path');

const REQUIRED_AGENT_SECTIONS = [
    'Role',
    'Tone',
    'Capabilities',
    'Mission',
    'Rules & Constraints',
    'Boundaries',
    'Workflow',
    'External Tooling Dependencies',
    'Audit Log'
];

const REQUIRED_GLOBAL_SECTIONS = [
    '🔐 Secrets & Configuration',
    '🛡 Error Handling and Resilience',
    '🚀 Execution Patterns',
    '🛠 Local Development & Authentication',
    '📝 Coding Standards'
];

const REQUIRED_TEMPLATE_MARKERS = [
    'GLOBAL_MANDATES',
    'AGENT_INDEX',
    'SKILLS_INJECTIONS',
    'MCP_INJECTIONS'
];

function parseCliArgs(argv) {
    let configOverride = null;

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg.startsWith('--config=')) {
            configOverride = arg.slice('--config='.length);
        } else if (arg === '--config') {
            configOverride = argv[index + 1] || null;
            index += 1;
        }
    }

    return { configOverride };
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readConfig(defaultConfigPath, configOverride) {
    const resolvedConfigPath = configOverride
        ? path.resolve(process.cwd(), configOverride)
        : defaultConfigPath;

    if (!fs.existsSync(resolvedConfigPath)) {
        throw new Error(`Config file not found: ${resolvedConfigPath}`);
    }

    const config = readJson(resolvedConfigPath);
    const activeMcps = config.active_mcps || [];
    const activeSkills = config.active_skills || [];

    if (!Array.isArray(activeMcps)) {
        throw new Error(`active_mcps in ${resolvedConfigPath} must be an array.`);
    }

    if (!Array.isArray(activeSkills)) {
        throw new Error(`active_skills in ${resolvedConfigPath} must be an array.`);
    }

    return {
        config: resolvedConfigPath,
        activeMcps,
        activeSkills
    };
}

function injectBetween(content, startTag, endTag, payload) {
    const startIndex = content.indexOf(startTag);
    const endIndex = content.indexOf(endTag);

    if (startIndex === -1 || endIndex === -1) {
        throw new Error(`Template markers not found: ${startTag} / ${endTag}`);
    }

    const pre = content.slice(0, startIndex + startTag.length);
    const post = content.slice(endIndex);
    return `${pre}\n${payload}\n${post}`;
}

function extractBetweenMarkers(content, markerName) {
    const startTag = `<!-- ${markerName}_START -->`;
    const endTag = `<!-- ${markerName}_END -->`;
    const startIndex = content.indexOf(startTag);
    const endIndex = content.indexOf(endTag);

    if (startIndex === -1 || endIndex === -1) {
        throw new Error(`Marker pair not found: ${startTag} / ${endTag}`);
    }

    return content.slice(startIndex + startTag.length, endIndex).trim();
}

function extractTopLevelSections(markdown) {
    const headingRegex = /^#\s+(.+)$/gm;
    const matches = [...markdown.matchAll(headingRegex)];
    const sections = [];

    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        const nextMatch = matches[index + 1];
        const title = match[1].trim();
        const bodyStart = match.index + match[0].length;
        const bodyEnd = nextMatch ? nextMatch.index : markdown.length;
        sections.push({
            title,
            body: markdown.slice(bodyStart, bodyEnd).trim()
        });
    }

    return sections;
}

function buildGlobalMandates(agentsMdPath) {
    if (!fs.existsSync(agentsMdPath)) {
        throw new Error(`AGENTS.md not found: ${agentsMdPath}`);
    }

    const content = fs.readFileSync(agentsMdPath, 'utf8');
    const sections = extractTopLevelSections(content);
    const titles = sections.map((section) => section.title);
    const missing = REQUIRED_GLOBAL_SECTIONS.filter((title) => !titles.includes(title));

    if (missing.length > 0) {
        throw new Error(`AGENTS.md is missing required top-level sections: ${missing.join(', ')}`);
    }

    return sections
        .map((section) => `## ${section.title}\n${section.body}\n`)
        .join('\n')
        .trim();
}

function discoverAgents(baseDir, prefix = '') {
    const agents = [];

    if (!fs.existsSync(baseDir)) {
        return agents;
    }

    const entries = fs.readdirSync(baseDir, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
        const fullPath = path.join(baseDir, entry.name);
        if (entry.isDirectory()) {
            agents.push(...discoverAgents(fullPath, path.join(prefix, entry.name)));
            continue;
        }

        if (!entry.name.endsWith('.md')) {
            continue;
        }

        const relativePath = path.join(prefix, entry.name);
        const content = fs.readFileSync(fullPath, 'utf8');
        const titleMatch = content.match(/^#\s+(.+)/m);
        const roleMatch = content.match(/## Role\s*\n([\s\S]*?)(?=\n## |\n$)/);
        const title = titleMatch ? titleMatch[1].trim() : entry.name.replace('.md', '');
        const role = roleMatch ? roleMatch[1].trim().split('\n')[0] : '';

        agents.push({
            path: `agents/${relativePath}`,
            title,
            role: role.slice(0, 200),
            domain: prefix.split(path.sep)[0] || 'root'
        });
    }

    return agents;
}

function buildAgentIndex(agents) {
    if (agents.length === 0) {
        return '<!-- No agent specifications discovered. -->';
    }

    const byDomain = {};
    for (const agent of agents) {
        if (!byDomain[agent.domain]) {
            byDomain[agent.domain] = [];
        }
        byDomain[agent.domain].push(agent);
    }

    let output = '## Agent Index\n\n';
    output += `${agents.length} agent specifications across ${Object.keys(byDomain).length} domains:\n\n`;
    output += '| Domain | Agent | Role | Spec File |\n';
    output += '|--------|-------|------|-----------|\n';

    for (const domain of Object.keys(byDomain).sort()) {
        for (const agent of byDomain[domain]) {
            const role = agent.role ? agent.role.replace(/\|/g, '\\|') : '';
            output += `| ${domain} | ${agent.title} | ${role} | \`${agent.path}\` |\n`;
        }
    }

    output += '\nRead the relevant agent specification before performing domain-specific tasks.\n';
    return output;
}

function buildSkillsSection(activeSkills, skillsDir) {
    if (activeSkills.length === 0) {
        return '<!-- No active skills configured in mcp.config.json -->';
    }

    let output = '## Active Skills\n\n';
    output += `${activeSkills.length} reusable skills available. Agents reference these in their Workflow sections.\n`;

    for (const skill of activeSkills) {
        const skillFile = path.join(skillsDir, `${skill}.md`);
        if (fs.existsSync(skillFile)) {
            output += `\n${fs.readFileSync(skillFile, 'utf8').trim()}\n`;
        } else {
            output += `\n### ${skill}\n\n> Warning: Skill file missing - skills/${skill}.md\n`;
        }
    }

    return output.trim();
}

function toTitleCase(value) {
    return value
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function buildMcpSection(activeMcps, protocolsDir) {
    if (activeMcps.length === 0) {
        return '<!-- No active MCPs configured in mcp.config.json -->';
    }

    let output = '## Active MCP Protocols\n\n';
    output += 'The following MCP integrations are active. When working with these tools, follow the protocol rules below.\n';

    for (const mcp of activeMcps) {
        const protocolFile = path.join(protocolsDir, `${mcp}.md`);
        output += `\n### ${toTitleCase(mcp)} Protocol\n\n`;
        if (fs.existsSync(protocolFile)) {
            output += `${fs.readFileSync(protocolFile, 'utf8').trim()}\n`;
        } else {
            output += `> Warning: Protocol file missing - mcp-protocols/${mcp}.md\n`;
        }
    }

    return output.trim();
}

function extractAgentHeadings(content) {
    return [...content.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
}

module.exports = {
    REQUIRED_AGENT_SECTIONS,
    REQUIRED_GLOBAL_SECTIONS,
    REQUIRED_TEMPLATE_MARKERS,
    buildAgentIndex,
    buildGlobalMandates,
    buildMcpSection,
    buildSkillsSection,
    discoverAgents,
    extractAgentHeadings,
    extractBetweenMarkers,
    extractTopLevelSections,
    injectBetween,
    parseCliArgs,
    readConfig
};
