/**
 * Stub for the Cloudflare `agents` peer dependency `ai` (Vercel AI SDK).
 * Our Worker only uses `createMcpHandler` from `agents/mcp` and never calls
 * the chat-client path that dynamically imports `ai`. Wrangler still bundles
 * that module graph, so alias `ai` → this stub in wrangler.toml.
 */
export const jsonSchema = undefined;
