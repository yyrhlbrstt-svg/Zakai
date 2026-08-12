import { beforeEach, describe, expect, it, vi } from "vitest";

const caseFindMany = vi.fn();
const authFindMany = vi.fn();
const outboxFindMany = vi.fn();
const proofFindMany = vi.fn();
const feeFindMany = vi.fn();
const consentFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: { findMany: (...a: unknown[]) => caseFindMany(...a) },
    authorization: { findMany: (...a: unknown[]) => authFindMany(...a) },
    outbox: { findMany: (...a: unknown[]) => outboxFindMany(...a) },
    savingsProof: { findMany: (...a: unknown[]) => proofFindMany(...a) },
    fee: { findMany: (...a: unknown[]) => feeFindMany(...a) },
    consent: { findMany: (...a: unknown[]) => consentFindMany(...a) },
  },
}));

const { loadVisibleWork } = await import("./visibleWork");

const T = (iso: string) => new Date(iso);

function baseCase(over: Record<string, unknown> = {}) {
  return {
    id: "c1",
    provider: "cellcom",
    createdAt: T("2026-01-01T10:00:00Z"),
    approvedAt: null,
    ownershipVerifiedAt: null,
    ...over,
  };
}

beforeEach(() => {
  caseFindMany.mockReset();
  authFindMany.mockReset();
  outboxFindMany.mockReset();
  proofFindMany.mockReset();
  feeFindMany.mockReset();
  consentFindMany.mockReset();
  caseFindMany.mockResolvedValue([]);
  authFindMany.mockResolvedValue([]);
  outboxFindMany.mockResolvedValue([]);
  proofFindMany.mockResolvedValue([]);
  feeFindMany.mockResolvedValue([]);
  consentFindMany.mockResolvedValue([]);
});

describe("loadVisibleWork — reports actions at the strength they actually reached", () => {
  it("a QUEUED letter is never reported as having left", async () => {
    caseFindMany.mockResolvedValue([baseCase()]);
    outboxFindMany.mockResolvedValue([
      {
        id: "o1",
        caseId: "c1",
        toAddress: "service@cellcom.co.il",
        status: "QUEUED",
        error: null,
        createdAt: T("2026-01-02T10:00:00Z"),
        sentAt: null,
      },
    ]);

    const led = await loadVisibleWork("u1");
    const letter = led.events.find((e) => e.id === "out:o1")!;

    expect(letter.kind).toBe("letter_queued");
    expect(letter.reach).toBe("internal");
    expect(led.delivered).toBe(0);
    expect(led.waiting).toBe(1);
  });

  it("a FAILED letter is neither delivered nor silently queued", async () => {
    caseFindMany.mockResolvedValue([baseCase()]);
    outboxFindMany.mockResolvedValue([
      {
        id: "o2",
        caseId: "c1",
        toAddress: "service@cellcom.co.il",
        status: "FAILED",
        error: "550 mailbox unavailable",
        createdAt: T("2026-01-02T10:00:00Z"),
        sentAt: null,
      },
    ]);

    const led = await loadVisibleWork("u1");
    const letter = led.events.find((e) => e.id === "out:o2")!;

    expect(letter.kind).toBe("letter_failed");
    expect(letter.reach).toBe("internal");
    expect(letter.failure).toBe("550 mailbox unavailable");
    expect(led.delivered).toBe(0);
    expect(led.failed).toBe(1);
  });

  it("only a SENT letter counts as outward, and is dated by sentAt not createdAt", async () => {
    caseFindMany.mockResolvedValue([baseCase()]);
    outboxFindMany.mockResolvedValue([
      {
        id: "o3",
        caseId: "c1",
        toAddress: "service@cellcom.co.il",
        status: "SENT",
        error: null,
        createdAt: T("2026-01-02T10:00:00Z"),
        sentAt: T("2026-01-03T09:00:00Z"),
      },
    ]);

    const led = await loadVisibleWork("u1");
    const letter = led.events.find((e) => e.id === "out:o3")!;

    expect(letter.kind).toBe("letter_delivered");
    expect(letter.reach).toBe("outward");
    expect(letter.at.toISOString()).toBe("2026-01-03T09:00:00.000Z");
    expect(led.delivered).toBe(1);
    expect(led.waiting).toBe(0);
  });

  it("a SENT row with no sentAt falls back to a timestamp it can actually prove", async () => {
    caseFindMany.mockResolvedValue([baseCase()]);
    outboxFindMany.mockResolvedValue([
      {
        id: "o4",
        caseId: "c1",
        toAddress: "x@y.co.il",
        status: "SENT",
        error: null,
        createdAt: T("2026-01-02T10:00:00Z"),
        sentAt: null,
      },
    ]);

    const led = await loadVisibleWork("u1");
    expect(led.events.find((e) => e.id === "out:o4")!.at.toISOString()).toBe(
      "2026-01-02T10:00:00.000Z",
    );
  });
});

describe("loadVisibleWork — binds every action to the authority it was taken under", () => {
  it("carries the authority code onto the actions of that case", async () => {
    caseFindMany.mockResolvedValue([
      baseCase({ approvedAt: T("2026-01-01T11:00:00Z") }),
    ]);
    authFindMany.mockResolvedValue([
      {
        code: "ZK-7Q4K-2M9P",
        provider: "cellcom",
        status: "ACTIVE",
        issuedAt: T("2026-01-01T12:00:00Z"),
        revokedAt: null,
        caseId: "c1",
      },
    ]);
    outboxFindMany.mockResolvedValue([
      {
        id: "o1",
        caseId: "c1",
        toAddress: "service@cellcom.co.il",
        status: "SENT",
        error: null,
        createdAt: T("2026-01-02T10:00:00Z"),
        sentAt: T("2026-01-02T10:05:00Z"),
      },
    ]);

    const led = await loadVisibleWork("u1");
    for (const e of led.events) {
      expect(e.authorityCode).toBe("ZK-7Q4K-2M9P");
      expect(e.authorityRevoked).toBe(false);
    }
    expect(led.activeAuthorities).toBe(1);
    expect(led.underRevokedAuthority).toBe(0);
  });

  it("keeps actions taken under a since-revoked authority, and flags them", async () => {
    caseFindMany.mockResolvedValue([baseCase()]);
    authFindMany.mockResolvedValue([
      {
        code: "ZK-DEAD-0001",
        provider: "cellcom",
        status: "REVOKED",
        issuedAt: T("2026-01-01T12:00:00Z"),
        revokedAt: T("2026-01-05T12:00:00Z"),
        caseId: "c1",
      },
    ]);
    outboxFindMany.mockResolvedValue([
      {
        id: "o1",
        caseId: "c1",
        toAddress: "service@cellcom.co.il",
        status: "SENT",
        error: null,
        createdAt: T("2026-01-02T10:00:00Z"),
        sentAt: T("2026-01-02T10:05:00Z"),
      },
    ]);

    const led = await loadVisibleWork("u1");
    const letter = led.events.find((e) => e.id === "out:o1")!;

    // Withdrawing permission does not un-send the letter — it must still show.
    expect(letter).toBeDefined();
    expect(letter.authorityRevoked).toBe(true);
    expect(led.activeAuthorities).toBe(0);
    expect(led.underRevokedAuthority).toBeGreaterThan(0);
    // The grant and the revocation themselves are not "actions under" it.
    expect(led.events.some((e) => e.kind === "authority_revoked")).toBe(true);
  });
});

describe("loadVisibleWork — ordering and money", () => {
  it("is newest first", async () => {
    caseFindMany.mockResolvedValue([
      baseCase({
        approvedAt: T("2026-01-04T10:00:00Z"),
        ownershipVerifiedAt: T("2026-01-06T10:00:00Z"),
      }),
    ]);

    const led = await loadVisibleWork("u1");
    const times = led.events.map((e) => e.at.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("carries money as integer minor units, never a float", async () => {
    caseFindMany.mockResolvedValue([baseCase()]);
    proofFindMany.mockResolvedValue([
      { id: "p1", caseId: "c1", savingMonthly: 3000, recordedAt: T("2026-02-01T10:00:00Z") },
    ]);
    feeFindMany.mockResolvedValue([
      {
        id: "f1",
        caseId: "c1",
        amount: 540,
        createdAt: T("2026-02-01T10:01:00Z"),
        paidAt: T("2026-02-02T10:00:00Z"),
      },
    ]);

    const led = await loadVisibleWork("u1");
    const proof = led.events.find((e) => e.kind === "saving_documented")!;
    const raised = led.events.find((e) => e.kind === "fee_raised")!;
    const paid = led.events.find((e) => e.kind === "fee_paid")!;

    expect(proof.amountMinor).toBe(3000);
    expect(raised.amountMinor).toBe(540);
    expect(paid.amountMinor).toBe(540);
    for (const e of [proof, raised, paid]) {
      expect(Number.isInteger(e.amountMinor)).toBe(true);
    }
  });

  it("an empty account produces an empty ledger, not a fabricated one", async () => {
    const led = await loadVisibleWork("u1");
    expect(led.events).toEqual([]);
    expect(led.total).toBe(0);
    expect(led.delivered).toBe(0);
    expect(led.activeAuthorities).toBe(0);
  });
});
