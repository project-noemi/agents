const fs = require('fs');
const path = require('path');

const REQUIRED_AGENT_SECTIONS = [
    'Role',
    'Tone',
    'Capabilities',
    'Mission',
    'Rules & Constraints',
    'Data Inventory',
    'Boundaries',
    'Workflow',
    'External Tooling Dependencies',
    'Audit Log'
];

const REQUIRED_SKILL_SECTIONS = [
    'Purpose',
    'Inputs',
    'Procedure',
    'Outputs',
    'Data Inventory',
    'Rules & Constraints',
    'Boundaries',
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
        
        let role = '';
        if (roleMatch) {
            // Extract the full first paragraph (everything up to the first blank line),
            // not just the first sentence. This preserves descriptive accuracy for
            // multi-sentence Role definitions in the Agent Index. (Resolves drift
            // noted in the 2026-05-02 clarification "Agent Index Role Truncation".)
            const paragraph = roleMatch[1].trim().split(/\n\s*\n/)[0] || '';
            role = paragraph.replace(/\s+/g, ' ').trim();
        }

        agents.push({
            path: `agents/${relativePath}`,
            title,
            role: role.slice(0, 400),
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
    return [...content.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => match[1].trim());
}

function extractHeadingsWithLevel(content) {
    return [...content.matchAll(/^(#{2,4})\s+(.+)$/gm)].map((match) => ({
        level: match[1].length,
        text: match[2].trim(),
        index: match.index
    }));
}

function headingMatches(actual, required) {
    // Case-insensitive match, also accepting "Required (annotation)" forms.
    const lowerActual = actual.toLowerCase();
    const lowerRequired = required.toLowerCase();
    return lowerActual === lowerRequired || lowerActual.startsWith(`${lowerRequired} (`);
}

function refusalCriteriaIsH3UnderRules(content) {
    const headings = extractHeadingsWithLevel(content);
    let inRulesBlock = false;
    let rulesBlockEnded = false;
    for (const heading of headings) {
        const text = heading.text.toLowerCase();
        if (heading.level === 2) {
            // Crossing into a new H2 ends the previous H2's subsection scope.
            inRulesBlock = text === 'rules & constraints' || text.startsWith('rules & constraints (');
            rulesBlockEnded = !inRulesBlock;
        } else if (heading.level === 3 && text === 'refusal criteria') {
            return inRulesBlock;
        }
    }
    return false;
}

const AUDIT_LOG_SCHEMA_KEYS = ['task', 'inputs', 'actions', 'risks', 'result'];

function validateAuditLogShape(content) {
    // Find the Audit Log section body by locating the H2 heading and slicing to
    // the next top-level (H1/H2) heading or end of file.
    const headingRe = /^##\s+Audit Log\s*$/m;
    const startMatch = content.match(headingRe);
    if (!startMatch) {
        return { ok: false, reason: 'Audit Log section not found' };
    }
    const startIndex = startMatch.index + startMatch[0].length;
    const tail = content.slice(startIndex);
    const nextHeading = tail.match(/^#{1,2}\s+/m);
    const body = nextHeading ? tail.slice(0, nextHeading.index) : tail;
    // Try fenced JSON code block first, then a bare brace block.
    let jsonText = null;
    const fenced = body.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (fenced) {
        jsonText = fenced[1];
    } else {
        const bare = body.match(/(\{[\s\S]*?\})/);
        if (bare) {
            jsonText = bare[1];
        }
    }
    if (!jsonText) {
        return { ok: false, reason: 'no JSON object found in Audit Log section' };
    }
    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (error) {
        return { ok: false, reason: `Audit Log JSON parse error: ${error.message}` };
    }
    const missing = AUDIT_LOG_SCHEMA_KEYS.filter((key) => !(key in parsed));
    if (missing.length > 0) {
        return { ok: false, reason: `Audit Log missing keys: ${missing.join(', ')}` };
    }
    for (const arrayKey of ['inputs', 'actions', 'risks']) {
        if (!Array.isArray(parsed[arrayKey])) {
            return { ok: false, reason: `Audit Log key '${arrayKey}' must be an array` };
        }
    }
    for (const stringKey of ['task', 'result']) {
        if (typeof parsed[stringKey] !== 'string') {
            return { ok: false, reason: `Audit Log key '${stringKey}' must be a string` };
        }
    }
    return { ok: true };
}

// Conventional filenames that are exempt from the slug rule. These are widely
// used by tooling and conventions (Docker, React components, license files).
const SLUG_EXEMPT_FILENAMES = new Set([
    'Dockerfile',
    'Makefile',
    'LICENSE',
    'Procfile',
    'Gemfile'
]);

// Conventional prefixes that should also be tolerated (e.g., Dockerfile.gatekeeper).
const SLUG_EXEMPT_PREFIXES = ['Dockerfile.', 'Makefile.'];

function isSlugCompliantName(name) {
    // Slug rule: English-first, no spaces. Allowed characters are lowercase letters,
    // digits, hyphen, underscore, and dot. SHOUTY_SNAKE_CASE.md style files are
    // tolerated as canonical docs (REQUIREMENTS.md, AGENTS.md, README.md, etc.).
    // Dotfiles, Dockerfile/Makefile, and conventional PascalCase component files are allowed.
    if (name.startsWith('.')) {
        return true;
    }
    if (SLUG_EXEMPT_FILENAMES.has(name)) {
        return true;
    }
    for (const prefix of SLUG_EXEMPT_PREFIXES) {
        if (name.startsWith(prefix)) return true;
    }
    // Reject any whitespace.
    if (/\s/.test(name)) {
        return false;
    }
    // Allow canonical SHOUTY-style filenames: all-uppercase letters/digits/underscores
    // optionally followed by a lowercase extension (e.g., README.md, AGENT_TEMPLATE.md).
    if (/^[A-Z0-9_]+(?:\.[A-Za-z0-9]+)*$/.test(name)) {
        return true;
    }
    // Allow PascalCase component files commonly produced by React/Vue tooling
    // (e.g., AdminDashboard.js, UserList.tsx). These are out of scope for the
    // English-first slug rule which targets shipped artifacts (workflows, docs).
    if (/^[A-Z][A-Za-z0-9]*\.[a-z0-9]+$/.test(name)) {
        return true;
    }
    // Allow standard slug-based names (lowercase letters/digits with - _ . separators).
    if (/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(name)) {
        return true;
    }
    return false;
}

module.exports = {
    REQUIRED_AGENT_SECTIONS,
    REQUIRED_GLOBAL_SECTIONS,
    REQUIRED_SKILL_SECTIONS,
    REQUIRED_TEMPLATE_MARKERS,
    AUDIT_LOG_SCHEMA_KEYS,
    buildAgentIndex,
    buildGlobalMandates,
    buildMcpSection,
    buildSkillsSection,
    discoverAgents,
    extractAgentHeadings,
    extractBetweenMarkers,
    extractHeadingsWithLevel,
    extractTopLevelSections,
    headingMatches,
    injectBetween,
    isSlugCompliantName,
    parseCliArgs,
    readConfig,
    refusalCriteriaIsH3UnderRules,
    validateAuditLogShape
};
