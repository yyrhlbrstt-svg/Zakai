import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { provenSavings, recordSelfReportedSaving } from "./selfReportedSaving";

/**
 * The loop closing for the six engines that could not close it. Requires a live
 * database; skipped without DATABASE_URL, like the other integration suites.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

async function makeUser(tag: string) {
  return prisma.user.create({
    data: {
      email: `saving-${tag}-${Math.random().toString(36).slice(2)}@zakai.test`,
      name: "Saving Tester",
      phone: "+972500000000",
      passwordHash: "$2a$10$notarealhashnotarealhashnotarealhashnotarealhashno",
      referralCode: `rc_${Math.random().toString(36).slice(2, 10)}`,
    },
    select: { id: true },
  });
}

suite("a self-reported win closes the loop without inventing a fee", () => {
  it("creates a case and a proof", async () => {
    const user = await makeUser("happy");
    const r = await recordSelfReportedSaving({
      userId: user.id,
      vertical: "dormant",
      provider: "pension_fund",
      recoveredMinor: 50_000,
    });
    expect(r.ok).toBe(true);

    const proof = await prisma.savingsProof.findUnique({
      where: { caseId: r.ok ? r.caseId : "" },
    });
    expect(proof!.savingMonthly).toBe(50_000);
    expect(proof!.selfReported).toBe(true);
    expect(proof!.source).toBe("self_reported");
  });

  it("never creates a Fee, not even a waived one", async () => {
    // Eighteen percent of a number somebody typed is not a fee this company
    // could defend if a customer disputed it. And a WAIVED row would imply a
    // fee was owed and forgiven, when none was ever owed.
    const user = await makeUser("nofee");
    const r = await recordSelfReportedSaving({
      userId: user.id,
      vertical: "captive",
      provider: "insurance",
      recoveredMinor: 900_000,
    });
    const fee = await prisma.fee.findUnique({ where: { caseId: r.ok ? r.caseId : "" } });
    expect(fee).toBeNull();
  });

  it("records the case as SAVED without faking the states it never passed", async () => {
    // It never went through approval, ownership verification or dispatch.
    // Walking it through them would put timestamps in the ledger for events
    // that did not happen.
    const user = await makeUser("states");
    const r = await recordSelfReportedSaving({
      userId: user.id,
      vertical: "incident",
      provider: "insurer",
      recoveredMinor: 20_000,
    });
    const kase = await prisma.case.findUnique({ where: { id: r.ok ? r.caseId : "" } });
    expect(kase!.status).toBe("SAVED");
    expect(kase!.approvedAt).toBeNull();
    expect(kase!.ownershipVerifiedAt).toBeNull();
  });

  it("refuses an amount that is not a plausible self-report", async () => {
    const user = await makeUser("bounds");
    for (const bad of [0, -1, NaN, Infinity, 999_999_999]) {
      const r = await recordSelfReportedSaving({
        userId: user.id,
        vertical: "rights",
        provider: "tax_authority",
        recoveredMinor: bad,
      });
      expect(r.ok).toBe(false);
    }
  });

  it("keeps verified and self-reported totals apart", async () => {
    // A single total that blends documented outcomes with remembered ones is
    // the fake-traction anti-pattern with extra steps.
    const before = await provenSavings();
    const user = await makeUser("wall");
    await recordSelfReportedSaving({
      userId: user.id,
      vertical: "dormant",
      provider: "bank",
      recoveredMinor: 30_000,
    });
    const after = await provenSavings();

    expect(after.selfReportedMinor).toBe(before.selfReportedMinor + 30_000);
    expect(after.selfReportedCount).toBe(before.selfReportedCount + 1);
    // The verified side is untouched by a self-report.
    expect(after.verifiedMinor).toBe(before.verifiedMinor);
    expect(after.verifiedCount).toBe(before.verifiedCount);
  });
});
