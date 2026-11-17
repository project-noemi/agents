import corpusJson from "./corpus.generated.json";

export type CorpusChunk = {
  id: string;
  source: string;
  title: string;
  text: string;
  tokens: string[];
};

type Corpus = {
  generatedAt: string;
  documentCount: number;
  chunkCount: number;
  documents: Array<{ path: string; title: string; bytes: number }>;
  chunks: CorpusChunk[];
};

const corpus = corpusJson as Corpus;

/** Hard caps for DoS resistance (also enforced in tool Zod schemas). */
export const MAX_QUERY_CHARS = 500;
export const MAX_QUERY_TOKENS = 64;
export const MAX_PATH_OR_ID_CHARS = 512;

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, MAX_QUERY_TOKENS);
}

/** Simple TF overlap search over embedded corpus chunks. */
export function searchKnowledge(query: string, limit = 5): CorpusChunk[] {
  const clipped = query.slice(0, MAX_QUERY_CHARS);
  const qTokens = tokenize(clipped);
  if (qTokens.length === 0) return [];
  const scored = corpus.chunks.map((chunk) => {
    let score = 0;
    for (const t of qTokens) {
      const hits = chunk.tokens.filter((x) => x === t).length;
      score += hits;
      if (chunk.title.toLowerCase().includes(t)) score += 3;
    }
    return { chunk, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.max(limit, 1), 20))
    .map((s) => s.chunk);
}

export function getDocument(pathOrId: string): CorpusChunk | null {
  const byId = corpus.chunks.find((c) => c.id === pathOrId);
  if (byId) return byId;
  const bySource = corpus.chunks.filter((c) => c.source === pathOrId);
  if (bySource.length === 0) return null;
  return {
    id: bySource[0].id,
    source: pathOrId,
    title: bySource[0].title,
    text: bySource.map((c) => c.text).join("\n\n---\n\n").slice(0, 50000),
    tokens: [],
  };
}

export function listDocuments() {
  return corpus.documents;
}

export function corpusMeta() {
  return {
    generatedAt: corpus.generatedAt,
    documentCount: corpus.documentCount,
    chunkCount: corpus.chunkCount,
  };
}
