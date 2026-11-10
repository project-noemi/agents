import { describe, expect, it } from "vitest";
import corpusJson from "./corpus.generated.json";
import { getDocument, listDocuments, searchKnowledge } from "./search";

/**
 * Regression for the Guardian rules missing after release 2026.11.10.
 * Tamper resistance landed in #723; PromptShield and PIIGuard rules in #725.
 * The docs/agents/guardian copies of the personas are symlinks, so the
 * corpus indexes the canonical files once.
 */
const GUARDIAN_SOURCES = [
  "guardian-layer/README.md",
  "docs/agents/guardian/README.md",
  "agents/guardian/prompt-shield.md",
  "agents/guardian/pii-guard.md",
] as const;

type CorpusChunk = {
  source: string;
  title: string;
  text: string;
};

const chunks = (corpusJson as { chunks: CorpusChunk[] }).chunks;

function chunksFrom(source: string): CorpusChunk[] {
  return chunks.filter((chunk) => chunk.source === source);
}

describe("guardian corpus", () => {
  it("indexes the Guardian sources once and still excludes MACHINE_IDENTITY", () => {
    const paths = listDocuments().map((doc) => doc.path);
    for (const source of GUARDIAN_SOURCES) {
      expect(paths).toContain(source);
    }
    expect(paths).not.toContain("docs/agents/guardian/prompt-shield.md");
    expect(paths).not.toContain("docs/agents/guardian/pii-guard.md");
    expect(paths).not.toContain("docs/MACHINE_IDENTITY.md");
  });

  it("chunks the tamper-resistance rules from guardian-layer/README.md", () => {
    const tamper = chunksFrom("guardian-layer/README.md").find(
      (chunk) => chunk.title === "Tamper resistance",
    );
    expect(tamper).toBeDefined();
    expect(tamper?.text).toMatch(/Tamper resistance/);
    expect(tamper?.text).toMatch(
      /must not be able to edit, disable or silence its Guardian/,
    );
    expect(getDocument("guardian-layer/README.md")?.text).toMatch(
      /Tamper resistance/,
    );
  });

  it("chunks the PromptShield and PIIGuard rules", () => {
    const shield = chunksFrom("agents/guardian/prompt-shield.md")
      .map((chunk) => chunk.text)
      .join("\n");
    expect(shield).toMatch(/PromptShield/);
    expect(shield).toMatch(/Guardrail Tampering/);
    expect(shield).toMatch(/Retrieved Content Is Screened Too/);

    const pii = chunksFrom("agents/guardian/pii-guard.md")
      .map((chunk) => chunk.text)
      .join("\n");
    expect(pii).toMatch(/PIIGuard/);
    expect(pii).toMatch(/Guardrail Tampering/);
    expect(pii).toMatch(/redaction rules, classification tiers/);

    const index = chunksFrom("docs/agents/guardian/README.md")
      .map((chunk) => chunk.text)
      .join("\n");
    expect(index).toMatch(/PromptShield/);
    expect(index).toMatch(/PIIGuard/);
  });

  it("returns Guardian, tamper-resistance, PromptShield, and PIIGuard hits", () => {
    const guardian = searchKnowledge("guardian", 5);
    expect(
      guardian.some((hit) =>
        (GUARDIAN_SOURCES as readonly string[]).includes(hit.source),
      ),
    ).toBe(true);

    const tamper = searchKnowledge("guardian tamper resistance", 5);
    expect(
      tamper.some(
        (hit) =>
          hit.source === "guardian-layer/README.md" &&
          /Tamper resistance/.test(hit.text),
      ),
    ).toBe(true);

    const shieldBlob = searchKnowledge("PromptShield guardrail tampering", 5)
      .filter((hit) => hit.source === "agents/guardian/prompt-shield.md")
      .map((hit) => hit.text)
      .join("\n");
    expect(shieldBlob).toMatch(/PromptShield/);
    expect(shieldBlob).toMatch(/Guardrail Tampering/);

    const piiBlob = searchKnowledge("PIIGuard guardrail tampering", 5)
      .filter((hit) => hit.source === "agents/guardian/pii-guard.md")
      .map((hit) => hit.text)
      .join("\n");
    expect(piiBlob).toMatch(/PIIGuard/);
    expect(piiBlob).toMatch(/Guardrail Tampering/);
  });
});
