import { describe, expect, it } from "vitest";
import {
  MIN_PAIR_AGOROT,
  findOverlaps,
  likelyRedundant,
  maxAvoidableMonthlyAgorot,
} from "./overlappingServices";
import type { ChargeCategory, RecurringCharge } from "./subscriptions";

const charge = (
  merchant: string,
  monthlyAgorot: number,
  category: ChargeCategory = "digital",
): RecurringCharge => ({
  merchant,
  category,
  monthlyAgorot,
  occurrences: 3,
  providerKey: null, confidence: 1,
  chargedOn: [],
});

describe("findOverlaps", () => {
  /**
   * Neither charge looks wrong alone — each is a real service, correctly
   * priced, from a company you did agree to pay. They are only wrong
   * together, and a statement is a list, and a list hides pairs.
   */
  it("finds two vendors billing for the same kind of thing", () => {
    const out = findOverlaps([charge("Dropbox", 5_000), charge("Google Drive", 3_000)]);
    expect(out).toHaveLength(1);
    expect(out[0].charges.map((c) => c.merchant)).toEqual(["Dropbox", "Google Drive"]);
    expect(out[0].smallerMonthlyAgorot).toBe(3_000);
  });

  it("says nothing about a category with a single vendor", () => {
    expect(findOverlaps([charge("Dropbox", 5_000)])).toEqual([]);
  });

  it("does not pair a merchant with itself", () => {
    // The same vendor billing twice is a duplicate charge, a different
    // problem, and calling it an overlap would misdescribe it.
    expect(findOverlaps([charge("Dropbox", 5_000), charge("dropbox ", 5_000)])).toEqual([]);
  });

  it("reports every distinct pair, not just the top two", () => {
    // Three vendors is three pairs worth looking at. Collapsing to one would
    // hide the others.
    const out = findOverlaps([
      charge("A", 9_000),
      charge("B", 8_000),
      charge("C", 7_000),
    ]);
    expect(out).toHaveLength(3);
  });

  it("ignores charges too small to be worth anyone's attention", () => {
    const out = findOverlaps([
      charge("A", 9_000),
      charge("B", MIN_PAIR_AGOROT - 1),
    ]);
    expect(out).toEqual([]);
  });

  it("orders by how much could be avoided", () => {
    const out = findOverlaps([
      charge("A", 9_000),
      charge("B", 8_000),
      charge("C", 2_500),
    ]);
    expect(out[0].smallerMonthlyAgorot).toBe(8_000);
  });
});

describe("categories where two vendors are usually deliberate", () => {
  /**
   * Two mobile charges are usually two phone lines. The product cannot tell
   * from a statement which pairs are redundant, and asserting it would be a
   * fabricated claim — so the pair is shown and marked, never hidden and
   * never asserted.
   */
  it("marks rather than hides a commonly legitimate pair", () => {
    const out = findOverlaps([
      charge("סלקום", 9_000, "cellular"),
      charge("פרטנר", 8_000, "cellular"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].commonlyLegitimate).toBe(true);
  });

  it("puts rarely-legitimate pairs first", () => {
    const out = findOverlaps([
      charge("סלקום", 90_000, "cellular"),
      charge("פרטנר", 80_000, "cellular"),
      charge("Dropbox", 5_000, "digital"),
      charge("Google Drive", 3_000, "digital"),
    ]);
    // Software pair leads despite being far smaller, because two phone lines
    // are usually meant and two storage tools usually are not.
    expect(out[0].category).toBe("digital");
  });

  it("filters to the rarely-legitimate ones on request", () => {
    const out = findOverlaps([
      charge("סלקום", 9_000, "cellular"),
      charge("פרטנר", 8_000, "cellular"),
      charge("Dropbox", 5_000, "digital"),
      charge("Google Drive", 3_000, "digital"),
    ]);
    expect(likelyRedundant(out).every((o) => o.category === "digital")).toBe(true);
  });
});

describe("maxAvoidableMonthlyAgorot", () => {
  /**
   * The number is an upper bound and has to behave like one. A vendor
   * appearing in three pairs is still a single subscription, and summing per
   * pair would inflate it into something plainly untrue.
   */
  it("counts a vendor once however many pairs it appears in", () => {
    const out = findOverlaps([charge("A", 9_000), charge("B", 8_000), charge("C", 7_000)]);
    // Pairs are A-B, A-C, B-C; smaller sides are B, C, C → B + C once each.
    expect(maxAvoidableMonthlyAgorot(out)).toBe(8_000 + 7_000);
  });

  it("is zero when nothing overlaps", () => {
    expect(maxAvoidableMonthlyAgorot(findOverlaps([charge("A", 9_000)]))).toBe(0);
  });

  it("keeps money in integer agorot", () => {
    const out = findOverlaps([charge("A", 9_000.6), charge("B", 8_000.4)]);
    expect(Number.isInteger(maxAvoidableMonthlyAgorot(out))).toBe(true);
  });
});
