import { apiJson } from "@/lib/api/responses";

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function now() {
  return Date.now();
}

function cleanup(currentTime: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= currentTime) buckets.delete(key);
  }
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

export function rateLimit(request: Request, options: RateLimitOptions) {
  const currentTime = now();
  cleanup(currentTime);

  const bucketKey = `${options.key}:${getClientIp(request)}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= currentTime) {
    buckets.set(bucketKey, { count: 1, resetAt: currentTime + options.windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= options.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
  return apiJson(
    { error: "Too many requests", retryAfter },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfter),
        "x-ratelimit-limit": String(options.limit),
        "x-ratelimit-remaining": "0",
      },
    }
  );
}
