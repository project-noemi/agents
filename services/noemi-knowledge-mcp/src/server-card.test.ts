import { describe, expect, it } from "vitest";
import { buildServerCard } from "./server-card";

describe("buildServerCard", () => {
  it("includes streamable-http remotes to /mcp", () => {
    const card = buildServerCard({
      PUBLIC_ORIGIN: "https://mcp.noemi.newpush.com",
      SERVICE_NAME: "com.newpush/noemi-knowledge-mcp",
      SERVICE_VERSION: "0.1.0",
    });
    expect(card.name).toBe("com.newpush/noemi-knowledge-mcp");
    expect(card.description).toMatch(/read-only/i);
    expect(card.description).toMatch(/public documents only/i);
    expect(card.description).toMatch(/no sign-in/i);
    expect(card.remotes).toEqual([
      {
        type: "streamable-http",
        url: "https://mcp.noemi.newpush.com/mcp",
        supportedProtocolVersions: ["2025-06-18", "2025-03-26"],
      },
    ]);
  });
});
