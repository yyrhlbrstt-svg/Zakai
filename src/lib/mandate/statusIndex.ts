/**
 * Status-list bit positions for Mandate revocations.
 *
 * Every published revocation must carry a unique, never-reused `statusIndex`
 * so `/api/mandate/revocations` can flip the corresponding bit. A row without
 * an index is invisible to every offline verifier holding a cached list —
 * the live `/status/{jti}` endpoint would say revoked while the signed list
 * still looks active. That is a fail-open hole; this helper closes it.
 */

type RevocationDb = {
  mandateRevocation: {
    aggregate: (args: {
      _max: { statusIndex: true };
    }) => Promise<{ _max: { statusIndex: number | null } }>;
    findUnique: (args: {
      where: { jti: string };
      select: { jti: true; statusIndex: true; revokedAt: true; reason: true };
    }) => Promise<{
      jti: string;
      statusIndex: number | null;
      revokedAt: Date;
      reason: string | null;
    } | null>;
    create: (args: {
      data: {
        jti: string;
        statusIndex: number;
        reason?: string;
        internalNote?: string;
      };
      select: { jti: true; statusIndex: true; revokedAt: true; reason: true };
    }) => Promise<{
      jti: string;
      statusIndex: number | null;
      revokedAt: Date;
      reason: string | null;
    }>;
    update: (args: {
      where: { jti: string };
      data: { statusIndex: number; reason?: string };
      select: { jti: true; statusIndex: true; revokedAt: true; reason: true };
    }) => Promise<{
      jti: string;
      statusIndex: number | null;
      revokedAt: Date;
      reason: string | null;
    }>;
  };
};

/** Next free position. Indices are never reused. */
export async function nextStatusIndex(db: RevocationDb): Promise<number> {
  const top = await db.mandateRevocation.aggregate({ _max: { statusIndex: true } });
  return (top._max.statusIndex ?? -1) + 1;
}

/**
 * Publish (or repair) a revocation so it appears on the signed status list.
 * Idempotent: an already-indexed jti is left alone.
 */
export async function publishRevocation(
  db: RevocationDb,
  input: { jti: string; reason?: string; internalNote?: string },
): Promise<{
  jti: string;
  statusIndex: number;
  revokedAt: Date;
  reason: string | null;
}> {
  const existing = await db.mandateRevocation.findUnique({
    where: { jti: input.jti },
    select: { jti: true, statusIndex: true, revokedAt: true, reason: true },
  });

  if (existing?.statusIndex != null) {
    return {
      jti: existing.jti,
      statusIndex: existing.statusIndex,
      revokedAt: existing.revokedAt,
      reason: existing.reason,
    };
  }

  const statusIndex = await nextStatusIndex(db);

  if (existing) {
    // Legacy ops path wrote rows without an index — repair so offline lists catch up.
    const repaired = await db.mandateRevocation.update({
      where: { jti: input.jti },
      data: {
        statusIndex,
        ...(input.reason ? { reason: input.reason } : {}),
      },
      select: { jti: true, statusIndex: true, revokedAt: true, reason: true },
    });
    return {
      jti: repaired.jti,
      statusIndex: repaired.statusIndex as number,
      revokedAt: repaired.revokedAt,
      reason: repaired.reason,
    };
  }

  const created = await db.mandateRevocation.create({
    data: {
      jti: input.jti,
      statusIndex,
      reason: input.reason,
      internalNote: input.internalNote,
    },
    select: { jti: true, statusIndex: true, revokedAt: true, reason: true },
  });

  return {
    jti: created.jti,
    statusIndex: created.statusIndex as number,
    revokedAt: created.revokedAt,
    reason: created.reason,
  };
}
