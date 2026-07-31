import { describe, expect, it } from "vitest";
import {
  IL_CAPTIVE,
  captiveById,
  captiveFor,
  estimateCaptive,
  rankCaptive,
  type CaptiveEstimate,
} from "./products";

function est(id: string, monthlyMinor: number, months?: number): CaptiveEstimate {
  return estimateCaptive(captiveById(id)!, monthlyMinor, months);
}

describe("the catalogue states a range, never a figure", () => {
  it("gives every product a low and a high that are actually different", () => {
    // A range collapsed to a point is a forecast about a person we have not
    // met, and it is the exact claim that makes "review your insurance" a
    // phrase people already distrust.
    for (const p of IL_CAPTIVE) {
      const [lo, hi] = p.typicalPremiumOverMarket;
      expect(lo).toBeGreaterThan(0);
      expect(hi).toBeGreaterThan(lo);
    }
  });

  it("cites the right to leave for every entry", () => {
    // "You may switch" is the part people disbelieve. Without a citation it is
    // an assertion; with one it is something a person can hold up at a counter.
    for (const p of IL_CAPTIVE) {
      expect(p.rightToSwitch.trim().length).toBeGreaterThan(12);
    }
  });

  it("keeps what the person must produce short", () => {
    // A long list of prerequisites is a refusal wearing a form.
    for (const p of IL_CAPTIVE) {
      expect(p.needs.length).toBeGreaterThan(0);
      expect(p.needs.length).toBeLessThanOrEqual(3);
    }
  });

  it("has no duplicate ids to disagree with each other", () => {
    const ids = IL_CAPTIVE.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks the ones you cannot leave unilaterally", () => {
    // Where the incumbent has to cooperate the honest framing is a negotiation,
    // not a switch, and the expected outcome is smaller. Losing that distinction
    // is how a product starts promising things it cannot deliver.
    const blocked = IL_CAPTIVE.filter((p) => !p.switchableWithoutIncumbent);
    expect(blocked.length).toBeGreaterThan(0);
  });
});

describe("the arithmetic everyone gets wrong", () => {
  it("computes the saving as a share of what is paid, not of the market price", () => {
    // Paying 40% over market means the bill is 140 where the market is 100, so
    // the saving is 40/140 — 28.6% of the bill. Treating it as 40% overstates
    // the win by half again, in the direction that flatters us.
    const p = {
      id: "t",
      category: "insurance" as const,
      reason: "opaque_pricing" as const,
      typicalPremiumOverMarket: [0.4, 0.4] as [number, number],
      rightToSwitch: "x".repeat(20),
      needs: ["a"],
      switchableWithoutIncumbent: true,
    };
    const e = estimateCaptive(p, 10_000);
    // 10,000 agorot × 12 = 120,000 a year; 0.4/1.4 of that is 34,286.
    expect(e.annualSavingRangeMinor[0]).toBe(34_286);
    expect(e.annualSavingRangeMinor[1]).toBe(34_286);
    // And emphatically not 48,000.
    expect(e.annualSavingRangeMinor[0]).toBeLessThan(120_000 * 0.4);
  });

  it("never claims a saving larger than the bill itself", () => {
    // over/(1+over) is bounded below 1 for any premium, however extreme. A naive
    // multiplication would tell somebody paying a 250% margin that they save
    // more than they spend.
    for (const p of IL_CAPTIVE) {
      const e = estimateCaptive(p, 50_000);
      expect(e.annualSavingRangeMinor[1]).toBeLessThan(50_000 * 12);
    }
  });

  it("returns integers, because money is not a float", () => {
    for (const p of IL_CAPTIVE) {
      const e = estimateCaptive(p, 7_777, 211);
      for (const v of e.annualSavingRangeMinor) expect(Number.isInteger(v)).toBe(true);
      for (const v of e.lifetimeSavingRangeMinor!) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("scales the lifetime figure by the remaining term, not by a default one", () => {
    // A mortgage policy with 22 years left is worth vastly more than the annual
    // number suggests, and inventing a term when none was given would be a
    // guess presented as a total.
    const e = est("mortgage_life_insurance", 12_000, 240);
    expect(e.lifetimeSavingRangeMinor).not.toBeNull();
    const [lifeLo] = e.lifetimeSavingRangeMinor!;
    const [annualLo] = e.annualSavingRangeMinor;
    expect(lifeLo).toBeCloseTo(annualLo * 20, -3);
  });

  it("says nothing about the lifetime when the term was not given", () => {
    expect(est("credit_card_fx_margin", 4_000).lifetimeSavingRangeMinor).toBeNull();
    expect(est("credit_card_fx_margin", 4_000, 0).lifetimeSavingRangeMinor).toBeNull();
  });

  it("does not turn a nonsensical input into a negative saving", () => {
    const e = est("pension_management_fees", -500);
    expect(e.currentMonthlyMinor).toBe(0);
    expect(e.annualSavingRangeMinor).toEqual([0, 0]);
  });

  it("scales linearly with what the person actually pays", () => {
    // The estimate is anchored to their number, not to a typical one. Two
    // assumptions multiplied together would be a fabrication with a decimal point.
    const small = est("pension_management_fees", 10_000).annualSavingRangeMinor[0];
    const large = est("pension_management_fees", 20_000).annualSavingRangeMinor[0];
    expect(large).toBeCloseTo(small * 2, -1);
  });
});

describe("ranking uses the number we would defend, not the one we would like", () => {
  it("orders by the conservative end of the range", () => {
    // Sorting on the optimistic end ranks entries by how boldly somebody wrote
    // the estimate, which quietly rewards the least disciplined guess.
    const bold = {
      id: "bold",
      category: "banking" as const,
      reason: "opaque_pricing" as const,
      typicalPremiumOverMarket: [0.05, 3] as [number, number],
      rightToSwitch: "x".repeat(20),
      needs: ["a"],
      switchableWithoutIncumbent: true,
    };
    const steady = { ...bold, id: "steady", typicalPremiumOverMarket: [0.4, 0.5] as [number, number] };

    const ranked = rankCaptive([estimateCaptive(bold, 10_000), estimateCaptive(steady, 10_000)]);
    expect(ranked[0].product.id).toBe("steady");
    // The bold entry does have the larger optimistic figure — it just does not win on it.
    expect(ranked[1].annualSavingRangeMinor[1]).toBeGreaterThan(ranked[0].annualSavingRangeMinor[1]);
  });

  it("is stable and does not mutate its input", () => {
    const input = [est("credit_card_fx_margin", 3_000), est("mortgage_life_insurance", 3_000)];
    const before = input.map((e) => e.product.id);
    const a = rankCaptive(input).map((e) => e.product.id);
    const b = rankCaptive([...input].reverse()).map((e) => e.product.id);
    expect(a).toEqual(b);
    expect(input.map((e) => e.product.id)).toEqual(before);
  });

  it("puts the monthly commitment above the occasional one at equal spend", () => {
    // A pension fee is charged forever; an FX margin only when travelling. At
    // the same monthly figure the recurring one is the bigger prize.
    const ranked = rankCaptive([est("credit_card_fx_margin", 5_000), est("pension_management_fees", 5_000)]);
    expect(ranked.map((e) => e.product.id)).toContain("pension_management_fees");
  });
});

describe("matching needs no bank connection, no upload, no document", () => {
  it("returns nothing for facts it was not given", () => {
    // Silence is the correct output for an empty profile. Listing everything
    // "just in case" is how a money app becomes a catalogue nobody reads.
    expect(captiveFor({})).toEqual([]);
    expect(captiveFor({ hasMortgage: false, employed: false })).toEqual([]);
  });

  it("surfaces both mortgage policies from a single fact", () => {
    const ids = captiveFor({ hasMortgage: true }).map((p) => p.id);
    expect(ids).toEqual(["mortgage_life_insurance", "mortgage_property_insurance"]);
  });

  it("surfaces pension exposure from employment alone", () => {
    // Nobody chose their fund's fee schedule; they were placed in it. That is
    // knowable from one tap, which is the entire argument against needing a feed.
    expect(captiveFor({ employed: true }).map((p) => p.id)).toContain("pension_management_fees");
  });

  it("never returns a product twice", () => {
    const all = captiveFor({
      hasMortgage: true,
      hasCarLoan: true,
      employed: true,
      spendsForeignCurrency: true,
      holdsSecurities: true,
    });
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    expect(all.length).toBe(IL_CAPTIVE.length);
  });

  it("resolves every id it can emit", () => {
    for (const p of IL_CAPTIVE) expect(captiveById(p.id)).toBe(p);
    expect(captiveById("no_such_product")).toBeUndefined();
  });
});
