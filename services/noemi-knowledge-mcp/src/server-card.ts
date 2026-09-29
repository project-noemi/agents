export type ServerCardEnv = {
  PUBLIC_ORIGIN: string;
  SERVICE_NAME: string;
  SERVICE_VERSION: string;
};

export function buildServerCard(env: ServerCardEnv) {
  const origin = (env.PUBLIC_ORIGIN || "https://mcp.noemi.newpush.com").replace(
    /\/+$/,
    ""
  );
  return {
    $schema:
      "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: env.SERVICE_NAME || "com.newpush/noemi-knowledge-mcp",
    version: env.SERVICE_VERSION || "0.1.0",
    title: "NoéMI Knowledge MCP",
    description:
      "Searchable Project NoéMI public knowledge base (Bible, governance, methodology, Phase 0, skills) over Streamable HTTP.",
    websiteUrl: "https://noemi.newpush.com",
    repository: {
      url: "https://github.com/project-noemi/agents",
      source: "github",
      subfolder: "services/noemi-knowledge-mcp",
    },
    remotes: [
      {
        type: "streamable-http",
        url: `${origin}/mcp`,
        supportedProtocolVersions: ["2025-06-18", "2025-03-26"],
      },
    ],
  };
}
