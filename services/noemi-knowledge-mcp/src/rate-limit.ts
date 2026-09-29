/**
 * Lightweight per-isolate rate limiter for the public MCP transport.
 *
 * - SHA-256 hash of client IP (privacy-preserving bucket key)
 * - Sliding window count
 * - Fail-open on unexpected errors (availability over perfect enforcement)
 *
 * Isolate-local Maps are not globally consistent across Cloudflare POPs;
 * pair with Cloudflare Rate Limiting / WAF in production for hard caps.
 */

export type RateLimitOptions = {
  /** Logical route namespace (e.g. "mcp"). */
  route: string;
  /** Max requests per window. */
  maxRequests: number;
  /** Window length in ms. */
  windowMs: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function extractRequestIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function pruneIfNeeded(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
    if (buckets.size <= MAX_BUCKETS * 0.8) break;
  }
  // Still too large: drop arbitrary oldest-ish entries
  if (buckets.size > MAX_BUCKETS) {
    const overflow = buckets.size - Math.floor(MAX_BUCKETS * 0.8);
    let i = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      i += 1;
      if (i >= overflow) break;
    }
  }
}

/**
 * Returns true if the request is allowed.
 * Fail-open: on hashing/unexpected errors, allow the request.
 */
export async function checkRateLimit(
  ip: string,
  options: RateLimitOptions
): Promise<boolean> {
  try {
    const now = Date.now();
    const hash = await sha256Hex(ip);
    const key = `${options.route}:${hash}`;
    pruneIfNeeded(now);

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    if (existing.count >= options.maxRequests) {
      return false;
    }

    existing.count += 1;
    return true;
  } catch (err) {
    console.warn("RATE_LIMIT_FAIL_OPEN", err);
    return true;
  }
}

/** Test helper — clear isolate buckets. */
export function resetRateLimitBucketsForTests() {
  buckets.clear();
}
