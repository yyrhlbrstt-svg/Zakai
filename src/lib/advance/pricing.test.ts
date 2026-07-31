import { describe, expect, it } from "vitest";
import { bookPosition, priceAdvance, type AdvanceInput } from "./pricing";
import { predictOutcome, type ClaimObservation } from "../oracle/predict";

/** Evidence strong enough for the Oracle to call itself confident. */
function evidence(n: number, rate: number, amount: number, days: number): ClaimObservation[] {
  return Array.from({ length: n }, (_, i) => ({
    market: "IL",
    vertical: "arnona",
    counterparty: "haifa",
    paid: i < Math.round(n * rate),
    recoveredMinor: i < Math.round(n * rate) ? amount : 0,
    days,
  }));
}

const QUERY = { market: "IL", vertical: "arnona", counterparty: "haifa" };

function offerFor(over: Partial<AdvanceInput> = {}, obs = evidence(600, 0.85, 420_000, 45)) {
  return priceAdvance({
    prediction: predictOutcome(QUERY, obs),
    faceValueMinor: 420_000,
    feeRateBps: 1800,
    ...over,
  });
}

describe("it refuses by default", () => {
  it("makes no offer when the Oracle is not confident", () => {
    const offer = offerFor({}, evidence(20, 0.85, 420_000, 45));
    expect(offer.offered).toBe(false);
    if (!offer.offered) {
      expect(offer.reason).toBe("not_confident");
      expect(offer.explanation).toMatch(/not enough to price against/);
    }
  });

  it("makes no offer with no evidence at all", () => {
    expect(offerFor({}, []).offered).toBe(false);
  });

  it("makes no offer when nothing has ever actually been paid", () => {
    const offer = offerFor({}, evidence(600, 0, 0, 45));
    expect(offer.offered).toBe(false);
  });

  it("refuses a claim with no face value, and a fractional one", () => {
    for (const faceValueMinor of [0, -100, 1234.5]) {
      const offer = offerFor({ faceValueMinor });
      expect(offer.offered).toBe(false);
      if (!offer.offered) expect(offer.reason).toBe("invalid_input");
    }
  });

  it("refuses an advance too small to be worth moving", () => {
    const offer = offerFor({ faceValueMinor: 3_000 }, evidence(600, 0.85, 3_000, 45));
    expect(offer.offered).toBe(false);
    if (!offer.offered) expect(offer.reason).toBe("uneconomic");
  });
});

describe("concentration is checked before the price, not after", () => {
  it("refuses once the counterparty is at the cap, however good the claim", () => {
    const offer = offerFor({
      bookSizeMinor: 100_000_000,
      counterpartyExposureMinor: 10_000_000, // exactly 10%
    });
    expect(offer.offered).toBe(false);
    if (!offer.offered) {
      expect(offer.reason).toBe("concentration_limit");
      expect(offer.explanation).toMatch(/correlation/);
    }
  });

  it("allows the same claim below the cap", () => {
    const offer = offerFor({
      bookSizeMinor: 100_000_000,
      counterpartyExposureMinor: 2_000_000,
    });
    expect(offer.offered).toBe(true);
  });

  it("does not block when no book size is declared", () => {
    expect(offerFor({ counterpartyExposureMinor: 9_999_999 }).offered).toBe(true);
  });
});

describe("it prices off the pessimistic end, never the middle", () => {
  it("uses the lower bound of the credible interval", () => {
    const prediction = predictOutcome(QUERY, evidence(600, 0.85, 420_000, 45));
    const offer = priceAdvance({ prediction, faceValueMinor: 420_000, feeRateBps: 1800 });
    expect(offer.offered).toBe(true);
    if (offer.offered) {
      expect(offer.pricedAtProbability).toBe(prediction.interval[0]);
      expect(offer.pricedAtProbability).toBeLessThan(prediction.paidProbability);
    }
  });

  it("offers less when the same mean carries more uncertainty", () => {
    // Identical payment rate; one has a quarter of the evidence, so a wider
    // band and a lower floor to price from.
    const sure = offerFor({}, evidence(2000, 0.85, 420_000, 45));
    const shaky = offerFor({}, evidence(150, 0.85, 420_000, 45));
    expect(sure.offered && shaky.offered).toBe(true);
    if (sure.offered && shaky.offered) {
      expect(shaky.advanceMinor).toBeLessThan(sure.advanceMinor);
    }
  });

  it("offers less on a slower-paying claim", () => {
    const fast = offerFor({}, evidence(600, 0.85, 420_000, 20));
    const slow = offerFor({}, evidence(600, 0.85, 420_000, 300));
    if (fast.offered && slow.offered) {
      expect(slow.advanceMinor).toBeLessThan(fast.advanceMinor);
    }
  });

  it("never offers more than the claimant would net anyway", () => {
    const offer = offerFor();
    expect(offer.offered).toBe(true);
    if (offer.offered) {
      // Face value less the 18% fee is the ceiling; the advance sits well under.
      expect(offer.advanceMinor).toBeLessThan(420_000 * 0.82);
      expect(offer.advanceRate).toBeLessThan(0.82);
    }
  });

  it("never offers a negative or fractional amount", () => {
    for (const rate of [0.4, 0.6, 0.75, 0.9, 0.99]) {
      const offer = offerFor({}, evidence(800, rate, 500_000, 30));
      if (offer.offered) {
        expect(offer.advanceMinor).toBeGreaterThan(0);
        expect(Number.isInteger(offer.advanceMinor)).toBe(true);
      }
    }
  });
});

describe("the economics are stated, not asserted", () => {
  it("reports expected loss and profit, and never offers at a loss", () => {
    const offer = offerFor();
    expect(offer.offered).toBe(true);
    if (offer.offered) {
      expect(offer.expectedLossMinor).toBeGreaterThan(0);
      expect(offer.expectedProfitMinor).toBeGreaterThan(0);
      expect(offer.grossMarginMinor).toBe(420_000 - offer.advanceMinor);
    }
  });

  it("expects more loss on a riskier claim", () => {
    const safe = offerFor({}, evidence(800, 0.95, 400_000, 30));
    const risky = offerFor({}, evidence(800, 0.6, 400_000, 30));
    if (safe.offered && risky.offered) {
      // Proportionally, the risky claim carries far more expected loss.
      expect(risky.expectedLossMinor / risky.advanceMinor).toBeGreaterThan(
        safe.expectedLossMinor / safe.advanceMinor,
      );
    }
  });

  it("aggregates a book, because per-claim soundness is not book soundness", () => {
    const offers = [
      offerFor(),
      offerFor({}, evidence(800, 0.9, 300_000, 30)),
      offerFor({}, evidence(10, 0.9, 300_000, 30)), // refused
    ];
    const book = bookPosition(offers);
    expect(book.count).toBe(2);
    expect(book.refused).toBe(1);
    expect(book.advancedMinor).toBeGreaterThan(0);
    expect(book.expectedProfitMinor).toBeGreaterThan(0);
  });

  it("reports an empty book without inventing figures", () => {
    expect(bookPosition([])).toEqual({
      count: 0,
      advancedMinor: 0,
      expectedLossMinor: 0,
      expectedProfitMinor: 0,
      refused: 0,
    });
  });
});

describe("the book survives the model being somewhat wrong", () => {
  it("stays profitable when true rates run five points below what was observed", () => {
    // The scenario that kills a funding book: the model is not broken, just
    // slightly optimistic, across everything, for a quarter.
    let advanced = 0;
    let recovered = 0;

    for (let i = 0; i < 300; i++) {
      const observedRate = 0.75 + (i % 20) / 100;
      const offer = offerFor({}, evidence(800, observedRate, 400_000, 40));
      if (!offer.offered) continue;

      advanced += offer.advanceMinor;
      // Reality is five points worse than the evidence suggested.
      const trueRate = observedRate - 0.05;
      recovered += trueRate * 400_000;
    }

    expect(advanced).toBeGreaterThan(0);
    // Pricing off the interval floor with a risk margin is what buys this.
    expect(recovered).toBeGreaterThan(advanced);
  });
});
