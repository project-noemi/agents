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
    'Rules & Constraints (4D Diligence)',
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
    'VALUE_LENS_INJECTIONS',
    'OPERATING_PROFILE_INJECTIONS',
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
            role = roleMatch[1].trim().split('\n')[0];
            // Take only the first sentence if it exists
            const sentenceMatch = role.match(/^[^.!?]+[.!?]/);
            if (sentenceMatch) {
                role = sentenceMatch[0];
            }
        }

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

// ---------------------------------------------------------------------------
// Summary-injection helpers
//
// Generated context files inject SUMMARIES plus a pointer to the source spec,
// not full bodies. Full-body injection made CLAUDE.md ~110k chars (~27.6k
// tokens resident in every session) — 2.7x the size at which Claude Code warns
// about oversized memory files — while the Dynamic Persona Protocol already
// instructs agents to read specs on demand, so the bodies were paid for twice.
// The one deliberate exception is INLINE_FULL_PROTOCOLS below.
// ---------------------------------------------------------------------------

/**
 * Body of the first `##`–`####` section whose heading matches `headingName`
 * (case-insensitive), up to the next heading of the same or higher level.
 */
function extractSectionBody(markdown, headingName) {
    const headingRegex = /^(#{2,4})\s+(.+)$/gm;
    const matches = [...markdown.matchAll(headingRegex)];
    for (let index = 0; index < matches.length; index += 1) {
        if (matches[index][2].trim().toLowerCase() !== headingName.toLowerCase()) {
            continue;
        }
        const level = matches[index][1].length;
        const bodyStart = matches[index].index + matches[index][0].length;
        let bodyEnd = markdown.length;
        for (let next = index + 1; next < matches.length; next += 1) {
            if (matches[next][1].length <= level) {
                bodyEnd = matches[next].index;
                break;
            }
        }
        return markdown.slice(bodyStart, bodyEnd).trim();
    }
    return '';
}

/**
 * Leading sentences of the first paragraph, up to ~`budget` characters.
 * Deterministic on purpose: fixtures pin the generated output, so the same
 * input must always summarize identically.
 */
function firstSentences(text, budget = 240) {
    const paragraph = text.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
    if (paragraph.length <= budget) {
        return paragraph;
    }
    // Split only on punctuation FOLLOWED BY whitespace. A match-based split
    // (`[^.!?]+[.!?]+\s`) silently drops leading text when a sentence carries
    // internal dots — `YYYY.MM.DD` in release-herald's Purpose surfaced as a
    // summary starting mid-word ("DD` releases...").
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    let output = '';
    for (const sentence of sentences) {
        if (output && `${output} ${sentence}`.length > budget) {
            break;
        }
        output = output ? `${output} ${sentence}` : sentence;
    }
    // Hard cap for a first sentence with no usable break: bounded beats huge.
    if (output.length > budget * 2) {
        output = `${output.slice(0, budget * 2).trim()}…`;
    }
    return output;
}

function buildSkillsSection(activeSkills, skillsDir) {
    if (activeSkills.length === 0) {
        return '<!-- No active skills configured in mcp.config.json -->';
    }

    let output = '## Active Skills\n\n';
    output += `${activeSkills.length} reusable skills available. Agents reference these in their Workflow sections.\n`;
    output += 'Summaries only: **read the full skill spec before executing it** — the Procedure, Boundaries, and Refusal Criteria that govern execution live in the spec, not here.\n';
    output += 'All skills, always: adhere to the defined Boundaries and **never exceed authorized tool usage**; each skill\'s hard gates (`Ask First` / `Never`) are reproduced below verbatim.\n';

    for (const skill of activeSkills) {
        const skillFile = path.join(skillsDir, `${skill}.md`);
        if (!fs.existsSync(skillFile)) {
            output += `\n### ${skill}\n\n> Warning: Skill file missing - skills/${skill}.md\n`;
            continue;
        }
        const content = fs.readFileSync(skillFile, 'utf8');
        const titleMatch = content.match(/^#\s+(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : skill;
        const purpose = firstSentences(extractSectionBody(content, 'Purpose'));
        output += `\n### ${title}\n\n`;
        output += `- **Spec:** \`skills/${skill}.md\`\n`;
        if (purpose) {
            output += `- **Purpose:** ${purpose}\n`;
        }
        // The skill's hard gates stay resident: Ask First (human-approval
        // gates) and Never (prohibitions) from ## Boundaries, verbatim.
        // Everything else in the spec is loaded on demand; these must not be.
        const boundaries = extractSectionBody(content, 'Boundaries');
        for (const line of boundaries.split('\n')) {
            const trimmed = line.trim();
            if (/^-\s+\*\*(Ask First|Never):\*\*/.test(trimmed)) {
                output += `${trimmed}\n`;
            }
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

function buildFrameworkSection(frameworkDir, headingLabel, sectionIntro, includeProhibitions = false) {
    if (!fs.existsSync(frameworkDir)) {
        return `<!-- Framework directory not found: ${path.basename(frameworkDir)} -->`;
    }

    const entries = fs.readdirSync(frameworkDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        // Exclude templates and READMEs so the injected payload only contains
        // operational framework definitions, not scaffolding docs.
        .filter((entry) => !entry.name.endsWith('_TEMPLATE.md'))
        .filter((entry) => entry.name.toLowerCase() !== 'readme.md')
        .sort((left, right) => left.name.localeCompare(right.name));

    if (entries.length === 0) {
        return `<!-- No ${headingLabel.toLowerCase()} defined in ${path.basename(frameworkDir)}/ -->`;
    }

    let output = `## ${headingLabel}\n\n${sectionIntro}\n`;
    output += 'Summaries only: **read the full spec before applying one** — success criteria, blind-spot registers, and audit requirements live in the spec, not here.\n';

    const dirName = path.basename(frameworkDir);
    for (const entry of entries) {
        const filePath = path.join(frameworkDir, entry.name);
        const content = fs.readFileSync(filePath, 'utf8');
        const titleMatch = content.match(/^#\s+(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : entry.name.replace('.md', '');

        // Metadata bullets worth keeping resident: the identifier and status
        // (lenses) — enough to select a lens without loading it.
        const metadata = extractSectionBody(content, 'Lens Metadata')
            || extractSectionBody(content, 'Profile Metadata');
        const idMatch = metadata.match(/\*\*Lens ID:\*\*\s*(`[^`]+`)/);
        const statusMatch = metadata.match(/\*\*Status:\*\*\s*(`[^`]+`)/);
        const purpose = firstSentences(extractSectionBody(content, 'Purpose'));
        const question = firstSentences(extractSectionBody(content, 'Core Success Question'), 300);

        output += `\n### ${title}\n\n`;
        output += `- **Spec:** \`${dirName}/${entry.name}\`\n`;
        if (idMatch || statusMatch) {
            const bits = [];
            if (idMatch) bits.push(`**Lens ID:** ${idMatch[1]}`);
            if (statusMatch) bits.push(`**Status:** ${statusMatch[1]}`);
            output += `- ${bits.join(' · ')}\n`;
        }
        if (purpose) {
            output += `- **Purpose:** ${purpose}\n`;
        }
        if (question) {
            output += `- **Core Success Question:** ${question}\n`;
        }
        // Lenses are exempt: their hard constraints are structured (tables,
        // "Not willing to sacrifice" lists) rather than keyword-marked, bind
        // only at deliberate lens application, and the keyword pull returned
        // Purpose echoes rather than rules. Profiles carry ambient behavioral
        // rules ("Never write secrets to ... user-facing output") that must
        // stay resident.
        if (includeProhibitions) {
            for (const rule of extractProhibitionParagraphs(content)) {
                output += `\n${blockquote(rule)}\n`;
            }
        }
    }

    return output.trim();
}

/**
 * Protocols whose FULL body stays inline in generated context.
 *
 * `github` is deliberately not summarized: it carries the machine-identity PR
 * authorship rules and the develop-only merge flow — the operational safety
 * contract for the fleet's own workflow. Safety-critical prohibitions must
 * stay always-loaded; a pointer that might not be followed is not a control
 * (Decision [2026-08-01-0002] context).
 */
const INLINE_FULL_PROTOCOLS = ['github'];

/**
 * Remove fenced code blocks before rule extraction. A fenced example that
 * quotes a CRITICAL or "Do not" phrase is illustration, not a rule — without
 * this it would be re-emitted verbatim (mangled onto one line, stray backticks
 * included) as a safety blockquote in every generated context file.
 */
function stripFencedBlocks(markdown) {
    return markdown.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
}

/**
 * Paragraphs carrying a hard rule: a **CRITICAL:** marker, or a "Do not" /
 * "Never" prohibition. These stay verbatim in generated context even when the
 * rest of the document is summarized — lazy-loading a "never do X" rule behind
 * a pointer that might not be followed is not a control. The adversarial
 * verification of this change found exactly that: protocols carry
 * must-not-class rules ("Do not overwrite existing content", "do not attempt
 * to bypass" a paywall) that are not CRITICAL-marked, so a CRITICAL-only
 * filter silently lazy-loaded them.
 */
function extractProhibitionParagraphs(markdown) {
    return stripFencedBlocks(markdown)
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.includes('**CRITICAL:**')
            || /\b[Dd]o not\b|\bNever\b/.test(paragraph))
        .map((paragraph) => paragraph
            // A rule heading sits on the line above its body in the source
            // files; keep the rule text, not a heading inside a quote.
            .split('\n')
            .filter((line) => !/^#{1,6}\s/.test(line.trim()))
            .join('\n')
            .trim())
        .filter((paragraph) => paragraph.length > 0);
}

/** Line-preserving blockquote, so multi-bullet rule blocks stay readable. */
function blockquote(paragraph) {
    return paragraph
        .split('\n')
        .map((line) => `> ${line}`.trimEnd())
        .join('\n');
}

function buildMcpSection(activeMcps, protocolsDir) {
    if (activeMcps.length === 0) {
        return '<!-- No active MCPs configured in mcp.config.json -->';
    }

    for (const required of INLINE_FULL_PROTOCOLS) {
        if (!activeMcps.includes(required)) {
            console.warn(`WARNING: '${required}' is in INLINE_FULL_PROTOCOLS but not in active_mcps — its always-loaded safety contract will be missing from generated context.`);
        }
    }

    let output = '## Active MCP Protocols\n\n';
    output += 'The following MCP integrations are active. Summaries below carry each protocol\'s hard rules (CRITICAL / "Do not" / "Never") verbatim; the full protocol file is the operative contract — **read it before first use of that MCP in a session.**\n';

    for (const mcp of activeMcps) {
        const protocolFile = path.join(protocolsDir, `${mcp}.md`);
        output += `\n### ${toTitleCase(mcp)} Protocol\n\n`;

        if (!fs.existsSync(protocolFile)) {
            output += `> Warning: Protocol file missing - mcp-protocols/${mcp}.md\n`;
            continue;
        }

        const content = fs.readFileSync(protocolFile, 'utf8');

        if (INLINE_FULL_PROTOCOLS.includes(mcp)) {
            output += `${content.trim()}\n`;
            continue;
        }

        output += `- **Protocol:** \`mcp-protocols/${mcp}.md\`\n`;
        for (const rule of extractProhibitionParagraphs(content)) {
            output += `\n${blockquote(rule)}\n`;
        }
    }

    return output.trim();
}

function extractAgentHeadings(content) {
    return [...content.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => match[1].trim());
}

function discoverSkills(baseDir) {
    const skills = [];

    if (!fs.existsSync(baseDir)) {
        return skills;
    }

    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
            .sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }
            if (!entry.name.endsWith('.md') || entry.name === 'SKILL_TEMPLATE.md') {
                continue;
            }
            skills.push({ path: fullPath });
        }
    }

    walk(baseDir);
    return skills;
}

module.exports = {
    INLINE_FULL_PROTOCOLS,
    REQUIRED_AGENT_SECTIONS,
    REQUIRED_GLOBAL_SECTIONS,
    REQUIRED_SKILL_SECTIONS,
    REQUIRED_TEMPLATE_MARKERS,
    buildAgentIndex,
    buildFrameworkSection,
    buildGlobalMandates,
    buildMcpSection,
    buildSkillsSection,
    discoverAgents,
    discoverSkills,
    extractAgentHeadings,
    extractBetweenMarkers,
    extractProhibitionParagraphs,
    extractSectionBody,
    extractTopLevelSections,
    firstSentences,
    injectBetween,
    parseCliArgs,
    readConfig
};
