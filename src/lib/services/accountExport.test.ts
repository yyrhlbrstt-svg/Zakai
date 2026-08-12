import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindUnique = vi.fn();
const caseFindMany = vi.fn();
const consentFindMany = vi.fn();
const commitmentFindMany = vi.fn();
const couponFindMany = vi.fn();
const deadlineFindMany = vi.fn();
const feedbackFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    case: { findMany: (...a: unknown[]) => caseFindMany(...a) },
    consent: { findMany: (...a: unknown[]) => consentFindMany(...a) },
    commitment: { findMany: (...a: unknown[]) => commitmentFindMany(...a) },
    coupon: { findMany: (...a: unknown[]) => couponFindMany(...a) },
    deadline: { findMany: (...a: unknown[]) => deadlineFindMany(...a) },
    feedback: { findMany: (...a: unknown[]) => feedbackFindMany(...a) },
  },
}));

const { buildAccountExport } = await import("./accountExport");

beforeEach(() => {
  for (const m of [
    userFindUnique,
    caseFindMany,
    consentFindMany,
    commitmentFindMany,
    couponFindMany,
    deadlineFindMany,
    feedbackFindMany,
  ]) {
    m.mockReset();
  }
  userFindUnique.mockResolvedValue({
    id: "u1",
    email: "a@b.co.il",
    name: "Dana",
    phone: "+972500000000",
    plan: "PRO",
    createdAt: new Date("2026-01-01"),
    emailVerifiedAt: null,
    referralCode: "ZK1",
    referralCreditAgorot: 0,
  });
  caseFindMany.mockResolvedValue([]);
  for (const m of [
    consentFindMany,
    commitmentFindMany,
    couponFindMany,
    deadlineFindMany,
    feedbackFindMany,
  ]) {
    m.mockResolvedValue([]);
  }
});

describe("account export — scoping", () => {
  it("scopes every query to the one account", async () => {
    await buildAccountExport("u1");
    expect(userFindUnique.mock.calls[0][0].where).toEqual({ id: "u1" });
    for (const m of [caseFindMany, consentFindMany, commitmentFindMany, couponFindMany, deadlineFindMany]) {
      expect(m.mock.calls[0][0].where).toEqual({ userId: "u1" });
    }
  });

  it("returns null for an account that is gone, rather than an empty shell", async () => {
    userFindUnique.mockResolvedValue(null);
    expect(await buildAccountExport("u1")).toBeNull();
  });
});

describe("account export — what must never be in the file", () => {
  it("never selects the password hash", async () => {
    await buildAccountExport("u1");
    const select = userFindUnique.mock.calls[0][0].select as Record<string, boolean>;
    expect(select.passwordHash).toBeUndefined();
    for (const key of Object.keys(select)) {
      expect(key.toLowerCase()).not.toContain("password");
      expect(key.toLowerCase()).not.toContain("hash");
      expect(key.toLowerCase()).not.toContain("token");
    }
  });

  it("carries no credential-shaped key anywhere in the serialised output", async () => {
    const out = await buildAccountExport("u1");
    const json = JSON.stringify(out);
    for (const bad of ["passwordHash", "codeHash", "sessionToken"]) {
      expect(json).not.toContain(bad);
    }
  });
});

describe("account export — what must be in the file", () => {
  it("includes the full letter bodies, not just their metadata", async () => {
    caseFindMany.mockResolvedValue([
      {
        id: "c1",
        provider: "cellcom",
        authorization: { code: "ZK-1", provider: "cellcom" },
        savingsProof: { savingMonthly: 3000 },
        fee: { amount: 540 },
        outbox: [
          {
            id: "o1",
            channel: "EMAIL",
            toAddress: "x@y.co.il",
            subject: "s",
            body: "the full letter text",
            status: "QUEUED",
            error: null,
            createdAt: new Date(),
            sentAt: null,
          },
        ],
      },
    ]);

    const out = await buildAccountExport("u1");
    expect(JSON.stringify(out)).toContain("the full letter text");
    expect(out!.outbox).toHaveLength(1);
    expect((out!.outbox[0] as { caseId: string }).caseId).toBe("c1");
  });

  it("lifts authorizations, proofs and fees out rather than losing them", async () => {
    caseFindMany.mockResolvedValue([
      {
        id: "c1",
        authorization: { code: "ZK-1" },
        savingsProof: { savingMonthly: 3000 },
        fee: { amount: 540 },
        outbox: [],
      },
      { id: "c2", authorization: null, savingsProof: null, fee: null, outbox: [] },
    ]);

    const out = await buildAccountExport("u1");
    expect(out!.cases).toHaveLength(2);
    // Nulls are dropped, not exported as empty objects that read like records.
    expect(out!.authorizations).toEqual([{ code: "ZK-1" }]);
    expect(out!.savingsProofs).toEqual([{ savingMonthly: 3000 }]);
    expect(out!.fees).toEqual([{ amount: 540 }]);
  });

  it("states the unit and the exclusions in the file itself", async () => {
    const out = await buildAccountExport("u1");
    const notes = out!.notes.join(" ");
    expect(notes).toContain("agorot");
    expect(out!.format).toBe("zakai-account-export/1");
  });

  it("survives a table that is not reachable rather than failing the whole export", async () => {
    couponFindMany.mockRejectedValue(new Error("relation does not exist"));
    const out = await buildAccountExport("u1");
    expect(out).not.toBeNull();
    expect(out!.coupons).toEqual([]);
  });
});
