import "server-only";

import { prisma } from "@/lib/prisma";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** Max length for client-supplied idempotency keys. */
export const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

/** Default retention for replay records (24h). */
export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 86_400;

export function normalizeIdempotencyKey(header: string | null | undefined): string | null {
  if (header == null) return null;
  const trimmed = header.trim();
  if (!trimmed || trimmed.length > MAX_IDEMPOTENCY_KEY_LENGTH) return null;
  return trimmed;
}

export function idempotencyKeyFromRequest(request: Request): string | null {
  return normalizeIdempotencyKey(request.headers.get(IDEMPOTENCY_HEADER));
}

export interface IdempotentResult<T extends Record<string, unknown>> {
  status: number;
  body: T;
  replayed: boolean;
}

/**
 * Execute a mutation once per (scope, actorId, key). Safe for client retries and
 * mobile double-taps at scale.
 */
export async function runIdempotent<T extends Record<string, unknown>>(opts: {
  scope: string;
  key: string | null;
  actorId: string;
  ttlSeconds?: number;
  run: () => Promise<{ status: number; body: T }>;
}): Promise<IdempotentResult<T>> {
  const ttl = opts.ttlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS;
  if (!opts.key) {
    const fresh = await opts.run();
    return { ...fresh, replayed: false };
  }

  const expiresAt = new Date(Date.now() + ttl * 1000);
  const existing = await prisma.idempotencyRecord.findUnique({
    where: {
      scope_actorId_key: {
        scope: opts.scope,
        actorId: opts.actorId,
        key: opts.key,
      },
    },
  });

  if (existing) {
    try {
      const body = JSON.parse(existing.responseJson) as T;
      return { status: existing.statusCode, body, replayed: true };
    } catch {
      /* corrupted row — fall through and overwrite */
    }
  }

  const fresh = await opts.run();
  const responseJson = JSON.stringify(fresh.body);

  try {
    await prisma.idempotencyRecord.upsert({
      where: {
        scope_actorId_key: {
          scope: opts.scope,
          actorId: opts.actorId,
          key: opts.key,
        },
      },
      create: {
        scope: opts.scope,
        actorId: opts.actorId,
        key: opts.key,
        statusCode: fresh.status,
        responseJson,
        expiresAt,
      },
      update: {
        statusCode: fresh.status,
        responseJson,
        expiresAt,
      },
    });
  } catch {
    /* race: another invocation won — return stored if possible */
    const raced = await prisma.idempotencyRecord.findUnique({
      where: {
        scope_actorId_key: {
          scope: opts.scope,
          actorId: opts.actorId,
          key: opts.key,
        },
      },
    });
    if (raced) {
      try {
        const body = JSON.parse(raced.responseJson) as T;
        return { status: raced.statusCode, body, replayed: true };
      } catch {
        /* ignore */
      }
    }
  }

  return { ...fresh, replayed: false };
}

/** Housekeeping — call from cron to prevent unbounded table growth. */
export async function purgeExpiredIdempotencyRecords(batchSize = 500): Promise<number> {
  const now = new Date();
  const stale = await prisma.idempotencyRecord.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true },
    take: batchSize,
  });
  if (stale.length === 0) return 0;
  const result = await prisma.idempotencyRecord.deleteMany({
    where: { id: { in: stale.map((s) => s.id) } },
  });
  return result.count;
}
