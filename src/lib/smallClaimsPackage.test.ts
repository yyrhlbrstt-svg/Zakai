import { describe, expect, it } from "vitest";
import {
  buildSmallClaimsPackage,
  smallClaimsFeeAgorot,
  SmallClaimsUnsupportedError,
  SMALL_CLAIMS_CAP_AGOROT,
  type SmallClaimsPackageInput,
} from "./smallClaimsPackage";

const BASE: SmallClaimsPackageInput = {
  vertical: "subscription",
  claimantName: "דנה כהן",
  company: "חברת הדוגמה בע\"מ",
  product: "מנוי חודשי",
  cancelNoticeDateLabel: "12.6.2026",
  chargedAfterAgorot: 23_800, // ₪238 actually observed
  timeline: [
    { dateLabel: "12.6.2026", label: "הודעת ביטול בכתב (נשלחה)" },
    { dateLabel: "3.7.2026", label: "מכתב מעקב — חיוב שנמשך (נשלחה)" },
  ],
};

describe("smallClaimsFeeAgorot — 1% with a ₪50 floor, integer agorot", () => {
  it("computes 1% above the floor", () => {
    expect(smallClaimsFeeAgorot(1_000_000)).toBe(10_000); // ₪10,000 → ₪100
  });
  it("applies the ₪50 minimum", () => {
    expect(smallClaimsFeeAgorot(23_800)).toBe(5_000);
    expect(smallClaimsFeeAgorot(0)).toBe(5_000);
    expect(smallClaimsFeeAgorot(-5)).toBe(5_000);
  });
});

describe("buildSmallClaimsPackage", () => {
  it("builds the statement with the statutory anchors and both remedies", () => {
    const pkg = buildSmallClaimsPackage(BASE);
    expect(pkg.claimStatement).toContain("חוק הגנת הצרכן");
    expect(pkg.claimStatement).toContain("סעיף 13ד");
    expect(pkg.claimStatement).toContain("סעיף 31א");
    expect(pkg.claimStatement).toContain("31א(ב)");
    expect(pkg.claimStatement).toContain("₪238"); // observed refund
    expect(pkg.claimStatement).toContain("₪10,000"); // graph cap, never typed here
    // Requested total = refund + statutory cap.
    expect(pkg.requestedTotalAgorot).toBe(23_800 + 1_000_000);
    expect(pkg.cappedByCeiling).toBe(false);
  });

  it("clamps the requested total to the small-claims ceiling and says so", () => {
    const pkg = buildSmallClaimsPackage({ ...BASE, chargedAfterAgorot: 5_000_000 });
    expect(pkg.requestedTotalAgorot).toBe(SMALL_CLAIMS_CAP_AGOROT);
    expect(pkg.cappedByCeiling).toBe(true);
    expect(pkg.claimStatement).toContain("הוגבל לתקרת הסמכות");
  });

  it("never claims a filing happened — the draft is filed by the person", () => {
    const pkg = buildSmallClaimsPackage(BASE);
    const all = pkg.claimStatement + pkg.filing.notesHe.join(" ");
    expect(all).not.toMatch(/הגשנו|הוגשה על ידינו|זכאי הגיש/);
    expect(pkg.filing.notesHe.join(" ")).toContain("מגיש/ה התובע/ת בעצמו/ה");
  });

  it("promises no outcome — exemplary damages are the court's discretion", () => {
    const pkg = buildSmallClaimsPackage(BASE);
    expect(pkg.filing.notesHe.join(" ")).toContain("שיקול דעת בית המשפט");
    expect(pkg.claimStatement).not.toMatch(/מובטח|בוודאות תקבל/);
  });

  it("includes only supplied identity fields — nothing invented", () => {
    const withoutId = buildSmallClaimsPackage(BASE);
    expect(withoutId.claimStatement).not.toContain('ת"ז');
    const withId = buildSmallClaimsPackage({ ...BASE, claimantIdNumber: "012345678" });
    expect(withId.claimStatement).toContain('ת"ז: 012345678');
  });

  it("carries the evidence list from the Rights Graph entry", () => {
    const pkg = buildSmallClaimsPackage(BASE);
    expect(pkg.evidenceChecklist.join(" ")).toContain("הודעת הביטול");
    expect(pkg.evidenceChecklist.join(" ")).toContain("לאחר מועד הביטול");
  });

  it("refuses verticals it has no narrative for", () => {
    expect(() => buildSmallClaimsPackage({ ...BASE, vertical: "telecom" })).toThrow(
      SmallClaimsUnsupportedError,
    );
    expect(() => buildSmallClaimsPackage({ ...BASE, vertical: "parking" })).toThrow(
      SmallClaimsUnsupportedError,
    );
  });

  it("handles the no-observed-amount case without inventing a number", () => {
    const pkg = buildSmallClaimsPackage({ ...BASE, chargedAfterAgorot: undefined });
    expect(pkg.claimStatement).toContain("על פי האסמכתאות");
    expect(pkg.requestedTotalAgorot).toBe(1_000_000); // cap only
    expect(pkg.claimStatement).not.toContain("₪238");
  });

  it("filing facts carry the source-dated cap and the fee rule", () => {
    const pkg = buildSmallClaimsPackage(BASE);
    expect(pkg.filing.capAgorot).toBe(3_990_000);
    expect(pkg.filing.capAsOf).toBe("2026-01-01");
    expect(pkg.filing.url).toMatch(/^https:\/\/www\.gov\.il\//);
    expect(pkg.filing.feeRuleHe).toContain("1%");
    expect(pkg.filing.notesHe.join(" ")).toContain("מתעדכנת מעת לעת");
  });
});
