import { describe, expect, it } from "vitest";
import {
  MAX_QUERY_CHARS,
  corpusMeta,
  getDocument,
  listDocuments,
  searchKnowledge,
} from "./search";

describe("corpus", () => {
  it("excludes MACHINE_IDENTITY.md as a source document", () => {
    const paths = listDocuments().map((d) => d.path);
    expect(paths).not.toContain("docs/MACHINE_IDENTITY.md");
    expect(corpusMeta().documentCount).toBeGreaterThan(0);
  });
});

describe("searchKnowledge", () => {
  it("returns ranked Phase 0 hits", () => {
    const hits = searchKnowledge("phase 0 security", 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(
      hits.some(
        (h) =>
          /phase\s*0/i.test(h.title) ||
          /phase\s*0/i.test(h.text) ||
          h.source.includes("PHASE_ZERO")
      )
    ).toBe(true);
  });

  it("clips oversized queries without throwing", () => {
    const huge = "phase 0 ".repeat(MAX_QUERY_CHARS);
    expect(() => searchKnowledge(huge, 3)).not.toThrow();
    expect(searchKnowledge(huge, 3).length).toBeGreaterThan(0);
  });
});

describe("getDocument", () => {
  it("fetches by source path", () => {
    const doc = getDocument("docs/PROJECT_REFERENCE.md");
    expect(doc).not.toBeNull();
    expect(doc?.source).toBe("docs/PROJECT_REFERENCE.md");
    expect(doc?.text.length).toBeGreaterThan(100);
  });

  it("returns null for unknown ids", () => {
    expect(getDocument("does-not-exist")).toBeNull();
  });
});
