import { describe, expect, it } from "vitest";
import { matchIntent } from "./intentRouter";
import { CATALOG } from "./priority";

describe("free-text intent routing", () => {
  it("routes a plain description of cancelling a subscription to /cancel", () => {
    const match = matchIntent("אני רוצה לבטל מנוי לחדר כושר שאני לא הולך אליו");
    expect(match?.id).toBe("cancel");
  });

  it("routes a bank-fee complaint to /bank-fees, not credit-card interest", () => {
    const match = matchIntent("הבנק חייב אותי עמלה מוזרה שלא הבנתי");
    expect(match?.id).toBe("bank-fees");
  });

  it("distinguishes a parking fine from a public-transport fine", () => {
    expect(matchIntent("קיבלתי דוח חניה ואני רוצה לערער")?.id).toBe("parking");
    expect(matchIntent("קיבלתי קנס באוטובוס כי לא היה לי כרטיס")?.id).toBe("transport-fine");
  });

  it("routes a landlord withholding a deposit to /deposit, not a generic complaint", () => {
    const match = matchIntent("המשכיר לא מחזיר לי את הפיקדון כבר חודשיים");
    expect(match?.id).toBe("deposit");
  });

  it("routes product warranty complaints to /warranty", () => {
    const match = matchIntent("המכשיר התקלקל בתוך האחריות והיבואן לא מתקן");
    expect(match?.id).toBe("warranty");
  });

  it("works in English too", () => {
    const match = matchIntent("my flight was cancelled and nobody compensated me", "en");
    expect(match?.id).toBe("flights");
  });

  it("returns null for input too short to mean anything", () => {
    expect(matchIntent("כן")).toBeNull();
    expect(matchIntent("")).toBeNull();
  });

  it("returns null for real text that matches no known pattern, rather than a wrong guess", () => {
    // Deliberately generic small talk — better to fall through to the
    // assistant than commit to the wrong Case flow.
    expect(matchIntent("מה נשמע היום, איך העסק")).toBeNull();
  });

  it("every keyword id resolves to a real catalog entry", () => {
    // Guards against the exact class of drift this file's own doc comment
    // warns other tables in this codebase about: an id here that no longer
    // matches priority.ts's CATALOG silently routes to nothing.
    const ids = new Set(CATALOG.map((a) => a.id));
    const matches = [
      "money", "cancel", "check", "bank-fees", "electricity", "refund-chase",
      "credit-card", "duplicate-insurance", "pension-fees", "payslip", "severance",
      "maternity", "unemployment", "miluim", "taxrefund", "flights", "parking", "warranty",
      "transport-fine", "late-payment", "overtime-backpay", "deposit",
      "contract-check", "scam-check", "complaint-escalation", "deadlines",
      "advance-tax", "school-payments", "dormant", "vehicleCheck", "incident",
    ];
    for (const id of matches) {
      expect(ids.has(id), `intentRouter references "${id}", missing from priority.ts CATALOG`).toBe(true);
    }
  });
});
