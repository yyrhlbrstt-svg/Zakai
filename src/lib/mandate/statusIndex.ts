/**
 * Status-list bit positions for Mandate revocations.
 *
 * Indices are allocated at **issue** time and embedded as `zkm.status.idx` so
 * offline verifiers can flip one bit on `/api/mandate/revocations` without a
 * live per-jti call. Revoke must reuse that index — inventing a new one at
 * revoke time would leave the token's claimed bit forever unset.
 */

type StatusIndexDb = {
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
  authorization?: {
    aggregate: (args: {
      _max: { mandateStatusIndex: true };
    }) => Promise<{ _max: { mandateStatusIndex: number | null } }>;
    findFirst?: (args: {
      where: { mandateJti: string };
      select: { mandateStatusIndex: true };
    }) => Promise<{ mandateStatusIndex: number | null } | null>;
  };
  mandateStatusAllocation?: {
    aggregate: (args: {
      _max: { statusIndex: true };
    }) => Promise<{ _max: { statusIndex: number | null } }>;
    create: (args: {
      data: { statusIndex: number; jti: string };
    }) => Promise<{ statusIndex: number; jti: string }>;
    findUnique: (args: {
      where: { jti: string };
      select: { statusIndex: true };
    }) => Promise<{ statusIndex: number } | null>;
  };
};

/** Next free position across allocations, authorizations, and revocations. */
export async function nextStatusIndex(db: StatusIndexDb): Promise<number> {
  const [revTop, authTop, allocTop] = await Promise.all([
    db.mandateRevocation.aggregate({ _max: { statusIndex: true } }),
    db.authorization
      ? db.authorization.aggregate({ _max: { mandateStatusIndex: true } })
      : Promise.resolve({ _max: { mandateStatusIndex: null } }),
    db.mandateStatusAllocation
      ? db.mandateStatusAllocation.aggregate({ _max: { statusIndex: true } })
      : Promise.resolve({ _max: { statusIndex: null } }),
  ]);
  return (
    Math.max(
      revTop._max.statusIndex ?? -1,
      authTop._max.mandateStatusIndex ?? -1,
      allocTop._max.statusIndex ?? -1,
    ) + 1
  );
}

/**
 * Reserve a fresh bit for a mandate being issued and record the jti→idx map.
 * Retries once on unique conflict (concurrent issuers).
 */
export async function allocateStatusIndex(
  db: StatusIndexDb,
  jti: string,
): Promise<number> {
  if (!db.mandateStatusAllocation) {
    // Unit tests that stub only revocation still get a monotonic index.
    return nextStatusIndex(db);
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const statusIndex = await nextStatusIndex(db);
    try {
      await db.mandateStatusAllocation.create({
        data: { statusIndex, jti },
      });
      return statusIndex;
    } catch {
      // Unique conflict — retry with a fresh max.
    }
  }
  throw new Error("could not allocate status index");
}

/** Look up the issue-time index for a jti, if reserved. */
export async function statusIndexForJti(
  db: StatusIndexDb,
  jti: string,
): Promise<number | undefined> {
  const allocated = await db.mandateStatusAllocation?.findUnique({
    where: { jti },
    select: { statusIndex: true },
  });
  if (typeof allocated?.statusIndex === "number") return allocated.statusIndex;

  // Case authorizations persist the bit on the human Authorization row even
  // when the allocation table was unavailable at issue (older deploys).
  const auth = await db.authorization?.findFirst?.({
    where: { mandateJti: jti },
    select: { mandateStatusIndex: true },
  });
  if (typeof auth?.mandateStatusIndex === "number") return auth.mandateStatusIndex;

  return undefined;
}

/**
 * Publish (or repair) a revocation so it appears on the signed status list.
 * Pass `statusIndex` from issue time so the token's `zkm.status.idx` flips.
 */
export async function publishRevocation(
  db: StatusIndexDb,
  input: {
    jti: string;
    reason?: string;
    internalNote?: string;
    /** Prefer the index embedded in the Mandate at issue. */
    statusIndex?: number;
  },
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

  const reserved =
    typeof input.statusIndex === "number" && Number.isInteger(input.statusIndex) && input.statusIndex >= 0
      ? input.statusIndex
      : await statusIndexForJti(db, input.jti);

  const statusIndex =
    typeof reserved === "number" ? reserved : await nextStatusIndex(db);

  if (existing) {
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

/** Default status-list URI for an issuer origin. */
export function statusListUriForIssuer(issuer: string): string {
  const base = issuer.replace(/\/+$/, "");
  return `${base}/api/mandate/revocations`;
}
