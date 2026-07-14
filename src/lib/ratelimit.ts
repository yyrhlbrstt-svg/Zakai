import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Durable fixed-window rate limiter backed by Postgres (serverless functions
 * don't share memory, so an in-process Map would not hold across invocations).
 *
 * Fail-open: if the datastore is unreachable we allow the request rather than
 * lock users out of auth — availability over strictness for this control.
 */
export async function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; remaining: number }> {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const key = `${bucket}:${identifier}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowMs);

  try {
    const rec = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: { increment: 1 } },
    });
    return { ok: rec.count <= limit, remaining: Math.max(0, limit - rec.count) };
  } catch {
    return { ok: true, remaining: limit };
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
