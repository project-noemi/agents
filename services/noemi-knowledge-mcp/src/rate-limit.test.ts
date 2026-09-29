import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  extractRequestIp,
  resetRateLimitBucketsForTests,
} from "./rate-limit";

afterEach(() => {
  resetRateLimitBucketsForTests();
});

describe("extractRequestIp", () => {
  it("prefers cf-connecting-ip", () => {
    const req = new Request("https://example.com/mcp", {
      headers: {
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.1",
      },
    });
    expect(extractRequestIp(req)).toBe("203.0.113.9");
  });

  it("falls back to first x-forwarded-for hop", () => {
    const req = new Request("https://example.com/mcp", {
      headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" },
    });
    expect(extractRequestIp(req)).toBe("198.51.100.2");
  });
});

describe("checkRateLimit", () => {
  it("allows under the budget then rejects", async () => {
    const opts = { route: "mcp-test", maxRequests: 2, windowMs: 60_000 };
    expect(await checkRateLimit("203.0.113.10", opts)).toBe(true);
    expect(await checkRateLimit("203.0.113.10", opts)).toBe(true);
    expect(await checkRateLimit("203.0.113.10", opts)).toBe(false);
  });

  it("isolates budgets per IP", async () => {
    const opts = { route: "mcp-test", maxRequests: 1, windowMs: 60_000 };
    expect(await checkRateLimit("203.0.113.11", opts)).toBe(true);
    expect(await checkRateLimit("203.0.113.12", opts)).toBe(true);
    expect(await checkRateLimit("203.0.113.11", opts)).toBe(false);
  });
});
