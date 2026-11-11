import { HttpError } from "./errors";
type Bucket = { count: number; resetAt: number };
const globalState = globalThis as typeof globalThis & { kulangorRateBuckets?: Map<string, Bucket> };
const buckets = globalState.kulangorRateBuckets ??= new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [id, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(id);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return; }
  if (bucket.count >= limit) throw new HttpError(429, "Too many requests. Please wait a minute and try again.");
  bucket.count++;
}

export function clientKey(request: Request): string {
  // Production reverse proxies must overwrite forwarded IP headers.
  return (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local").slice(0, 100);
}
