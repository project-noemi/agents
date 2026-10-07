import { basename, dirname } from "node:path";

const H1 = /^#\s+([^#].+)$/;
const SECTION = /^##\s+(.+)$/;
const SKILL = /\*\*Skill:\*\*\s+`([^`]+)`/g;

function normalizeHeading(raw) {
  return raw.replace(/\s*\(.*\)\s*$/, "").trim();
}

function slugFromTitle(title) {
  const [name, rest] = title.split("—").map((s) => s.trim());
  const domain = (rest || "")
    .replace(/\s+Agent$/i, "")
    .trim()
    .toLowerCase();
  return {
    name: (name || "unknown").toLowerCase(),
    domain: domain || "unknown",
  };
}

function idFromPath(filePath) {
  if (!filePath) return null;
  const parts = filePath.replaceAll("\\", "/").split("/").filter(Boolean);
  const mdAt = parts.findLastIndex((p) => p.endsWith(".md"));
  const fileEnd = mdAt >= 0 ? mdAt + 1 : parts.length;

  // Only treat agents/{domain}/{name}.md or agents/{domain}/{name}/file.md as
  // persona paths. The clone itself is named "agents", so a naive lastIndexOf
  // would map fixtures under tools/blueprint-compiler to "tools/blueprint-compiler".
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i] !== "agents") continue;
    const after = parts.slice(i + 1, fileEnd);
    if (after.length === 2 && after[1].endsWith(".md")) {
      return `${after[0]}/${after[1].replace(/\.md$/i, "")}`;
    }
    if (after.length === 3 && after[2].endsWith(".md")) {
      return `${after[0]}/${after[1]}`;
    }
  }

  const dir = basename(dirname(filePath));
  return dir || null;
}

/**
 * Parse a NoéMI Markdown persona into a Blueprint IR.
 * @param {string} markdown
 * @param {{ source?: { kind: "file" | "http" | "registry", ref: string } }} [opts]
 */
export function parseBlueprint(markdown, opts = {}) {
  const source = opts.source ?? { kind: "file", ref: "<string>" };
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let title = "";
  /** @type {Record<string, string[]>} */
  const buckets = {};
  let current = null;

  for (const line of lines) {
    const h1 = line.match(H1);
    if (h1 && !title && !current) {
      title = h1[1].trim();
      continue;
    }
    const heading = line.match(SECTION);
    if (heading) {
      current = normalizeHeading(heading[1]);
      if (!buckets[current]) buckets[current] = [];
      continue;
    }
    if (current) buckets[current].push(line);
  }

  const sections = {};
  for (const [key, bodyLines] of Object.entries(buckets)) {
    sections[key] = bodyLines.join("\n").trim();
  }

  const skills = new Set();
  for (const body of Object.values(sections)) {
    for (const match of body.matchAll(SKILL)) {
      skills.add(match[1].trim());
    }
  }

  const fromTitle = slugFromTitle(title || "Unknown — Unknown Agent");
  const pathId = source.kind === "file" ? idFromPath(source.ref) : null;
  const id =
    pathId && pathId.includes("/")
      ? pathId
      : `${fromTitle.domain}/${fromTitle.name}`;
  const [domain, name] = id.split("/");

  return {
    id,
    name: name ?? fromTitle.name,
    domain: domain ?? fromTitle.domain,
    title,
    sections,
    skills: [...skills],
    mcp: [],
    modelPolicy: {
      preferred: process.env.NOEMI_PREFERRED_PROVIDER ?? "mock",
      fallbacks: (process.env.NOEMI_FALLBACK_PROVIDERS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    },
    source,
  };
}
