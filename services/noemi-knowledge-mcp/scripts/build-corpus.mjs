#!/usr/bin/env node
/**
 * Build a searchable markdown corpus for the NoéMI knowledge MCP server.
 * Sources: agents docs + skills-dist (repo-relative).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(__dirname, "..");
const agentsRoot = path.resolve(serviceRoot, "../..");
const outFile = path.join(serviceRoot, "src/corpus.generated.json");

/**
 * Curated public corpus only (Decision [2026-09-22-0003]).
 * Do NOT include MACHINE_IDENTITY / internal identity registers or other
 * admin-architecture docs — those are not public knowledge-base material.
 */
/** @type {{ path: string, title?: string }[]} */
const SOURCES = [
  { path: "docs/PROJECT_REFERENCE.md", title: "NoéMI Bible / Project Reference" },
  { path: "docs/GOVERNANCE.md", title: "Governance" },
  { path: "docs/METHODOLOGY.md", title: "Methodology" },
  { path: "docs/PHASE_ZERO_SECURITY_BASELINE.md", title: "Phase 0 Security Baseline" },
];

function walkSkillsDist() {
  const root = path.join(agentsRoot, "skills-dist");
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      path: path.join("skills-dist", d.name, "SKILL.md"),
      title: `Skill: ${d.name}`,
    }));
}

function chunkMarkdown(text, sourcePath, title) {
  const parts = text.split(/\n(?=#{1,3}\s)/);
  const chunks = [];
  let i = 0;
  for (const part of parts) {
    const body = part.trim();
    if (body.length < 40) continue;
    const heading = body.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim() || title;
    const id = crypto
      .createHash("sha256")
      .update(`${sourcePath}:${i}:${heading}`)
      .digest("hex")
      .slice(0, 16);
    chunks.push({
      id,
      source: sourcePath,
      title: heading,
      text: body.slice(0, 12000),
      tokens: tokenize(body),
    });
    i += 1;
  }
  if (chunks.length === 0 && text.trim()) {
    const id = crypto.createHash("sha256").update(sourcePath).digest("hex").slice(0, 16);
    chunks.push({
      id,
      source: sourcePath,
      title,
      text: text.trim().slice(0, 12000),
      tokens: tokenize(text),
    });
  }
  return chunks;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

const allSources = [...SOURCES, ...walkSkillsDist()];
const documents = [];
const chunks = [];

for (const src of allSources) {
  const abs = path.join(agentsRoot, src.path);
  if (!fs.existsSync(abs)) {
    console.warn(`skip missing ${src.path}`);
    continue;
  }
  const text = fs.readFileSync(abs, "utf8");
  documents.push({
    path: src.path,
    title: src.title || src.path,
    bytes: Buffer.byteLength(text),
  });
  chunks.push(...chunkMarkdown(text, src.path, src.title || src.path));
}

const corpus = {
  generatedAt: new Date().toISOString(),
  documentCount: documents.length,
  chunkCount: chunks.length,
  documents,
  chunks,
};

fs.writeFileSync(outFile, JSON.stringify(corpus));
console.log(
  `wrote ${outFile} (${documents.length} docs, ${chunks.length} chunks)`
);
