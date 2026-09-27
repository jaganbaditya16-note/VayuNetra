import { NextResponse } from "next/server";
import { clientIp } from "./client-ip.ts";

export { clientIp } from "./client-ip.ts";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
let lastCleanup = 0;

export function checkRateLimit(
  request: Request,
  scope: string,
  limit = 30,
  windowMs = 60_000,
) {
  const now = Date.now();
  if (now - lastCleanup > 60_000) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
    lastCleanup = now;
  }
  const key = `${scope}:${clientIp(request)}`;
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return null;
  }

  if (existing.count >= limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    );

    return NextResponse.json(
      {
        error: "Too many requests. Please wait before trying again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  existing.count += 1;
  return null;
}
