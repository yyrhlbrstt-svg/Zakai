import { describe, expect, it } from "vitest";
import {
  betaCdf,
  betaQuantile,
  predictOutcome,
  rankByExpectedValue,
  type ClaimObservation,
  type OutcomeQuery,
} from "./predict";
import {
  assessCalibration,
  brierScore,
  expectedCalibrationError,
  reliabilityCurve,
  skillScore,
  type Forecast,
} from "./calibration";
import { seededRng } from "../strategy/selector";

/** Mirrors the module constant; a change to one should break the other. */
const MIN_TRIALS_FOR_PRICING = 100;

const IL: OutcomeQuery = { market: "IL", vertical: "arnona", counterparty: "haifa" };

function claims(
  n: number,
  rate: number,
  amount: number,
  days: number,
  over: Partial<ClaimObservation> = {},
): ClaimObservation[] {
  return Array.from({ length: n }, (_, i) => ({
    market: "IL",
    vertical: "arnona",
    counterparty: "haifa",
    paid: i < Math.round(n * rate),
    recoveredMinor: i < Math.round(n * rate) ? amount : 0,
    days,
    ...over,
  }));
}

describe("the maths is exact, so a price never drifts", () => {
  it("computes a Beta CDF that agrees with known values", () => {
    // Beta(1,1) is uniform.
    expect(betaCdf(0.25, 1, 1)).toBeCloseTo(0.25, 6);
    expect(betaCdf(0.75, 1, 1)).toBeCloseTo(0.75, 6);
    // Beta(2,2) is symmetric about 0.5.
    expect(betaCdf(0.5, 2, 2)).toBeCloseTo(0.5, 6);
    expect(betaCdf(0.5, 8, 2) + betaCdf(0.5, 2, 8)).toBeCloseTo(1, 6);
  });

  it("inverts it to a quantile", () => {
    for (const [a, b] of [[1, 1], [5, 3], [30, 70], [200, 20]]) {
      for (const p of [0.05, 0.5, 0.95]) {
        expect(betaCdf(betaQuantile(p, a, b), a, b)).toBeCloseTo(p, 4);
      }
    }
  });

  it("gives the same answer twice — no sampling anywhere", () => {
    const data = claims(200, 0.6, 30_000, 21);
    const a = predictOutcome(IL, data);
    const b = predictOutcome(IL, data);
    expect(a).toEqual(b);
  });
});

describe("it predicts what the evidence supports", () => {
  it("recovers a known payment rate", () => {
    const p = predictOutcome(IL, claims(400, 0.65, 30_000, 21));
    expect(p.paidProbability).toBeGreaterThan(0.6);
    expect(p.paidProbability).toBeLessThan(0.7);
    expect(p.expectedAmountMinor).toBe(30_000);
    expect(p.expectedDays).toBe(21);
  });

  it("brackets the truth in its interval", () => {
    const p = predictOutcome(IL, claims(500, 0.4, 10_000, 14));
    expect(p.interval[0]).toBeLessThan(0.4);
    expect(p.interval[1]).toBeGreaterThan(0.4);
  });

  it("narrows the interval as evidence accumulates", () => {
    const width = (n: number) => {
      const p = predictOutcome(IL, claims(n, 0.5, 10_000, 14));
      return p.interval[1] - p.interval[0];
    };
    expect(width(1000)).toBeLessThan(width(100));
    expect(width(100)).toBeLessThan(width(20));
  });

  it("reports expected value, which is what a decision uses", () => {
    const p = predictOutcome(IL, claims(400, 0.5, 100_000, 30));
    expect(p.expectedValueMinor).toBeGreaterThan(45_000);
    expect(p.expectedValueMinor).toBeLessThan(55_000);
  });

  it("uses the median for duration, because the tail is long", () => {
    const fast = claims(20, 1, 10_000, 10);
    const oneDisaster: ClaimObservation[] = [
      ...fast,
      { ...fast[0], days: 900 },
    ];
    // A mean would be dragged past 50; the median barely moves.
    expect(predictOutcome(IL, oneDisaster).expectedDays).toBeLessThan(20);
  });
});

describe("it refuses to price what it does not know", () => {
  it("is not confident with no evidence at all", () => {
    const p = predictOutcome(IL, []);
    expect(p.confident).toBe(false);
    expect(p.evidence.level).toBe("none");
    expect(p.evidence.trials).toBe(0);
  });

  it("is not confident on a handful of claims", () => {
    expect(predictOutcome(IL, claims(6, 0.5, 10_000, 14)).confident).toBe(false);
  });

  it("is not confident on forty claims, however tidy the number looks", () => {
    // A 90% band around eleven points wide reads as precise and is not. The
    // threshold that protects a consumer's afternoon and the one that protects
    // a balance sheet are different numbers; this is the second.
    const p = predictOutcome(IL, claims(40, 0.5, 10_000, 14));
    expect(p.confident).toBe(false);
  });

  it("is not confident while the interval is still wide, even with many claims", () => {
    // Enough trials to pass the count gate, but the rate near 0.5 keeps the
    // band open — both gates have to hold, not either.
    const p = predictOutcome(IL, claims(110, 0.5, 10_000, 14));
    expect(p.evidence.trials).toBeGreaterThanOrEqual(MIN_TRIALS_FOR_PRICING);
    expect(p.interval[1] - p.interval[0]).toBeGreaterThan(0.14);
    expect(p.confident).toBe(false);
  });

  it("does price a lopsided rate on the same evidence, where the band is tight", () => {
    // Identical sample size to the case above; the rate is far from a half, so
    // the interval is narrow enough to act on. Both gates are real.
    const p = predictOutcome(IL, claims(110, 0.9, 10_000, 14));
    expect(p.confident).toBe(true);
  });

  it("becomes confident once the evidence is genuinely there", () => {
    const p = predictOutcome(IL, claims(600, 0.75, 30_000, 21));
    expect(p.confident).toBe(true);
    expect(p.evidence.trials).toBe(600);
  });

  it("will not claim confidence without a single observed amount", () => {
    // Every claim refused: we know the odds, but nothing about the payout.
    const p = predictOutcome(IL, claims(500, 0, 0, 30));
    expect(p.confident).toBe(false);
    expect(p.expectedAmountMinor).toBe(0);
  });
});

describe("evidence flows down, and never across a border", () => {
  it("falls back to the vertical for an unseen counterparty", () => {
    const p = predictOutcome(
      { ...IL, counterparty: "netanya" },
      claims(300, 0.8, 20_000, 20),
    );
    expect(p.evidence.level).toBe("vertical");
    expect(p.paidProbability).toBeGreaterThan(0.6);
  });

  it("lets specific evidence outweigh the borrowed kind", () => {
    const data = [
      ...claims(400, 0.9, 20_000, 20), // haifa, strong
      ...claims(200, 0.1, 20_000, 20, { counterparty: "netanya" }),
    ];
    const p = predictOutcome({ ...IL, counterparty: "netanya" }, data);
    expect(p.evidence.level).toBe("counterparty");
    expect(p.paidProbability).toBeLessThan(0.35);
  });

  it("ignores another market entirely", () => {
    const british = claims(900, 0.95, 50_000, 10, { market: "GB" });
    const p = predictOutcome(IL, british);
    expect(p.evidence.level).toBe("none");
    expect(p.paidProbability).toBe(0.5); // untouched prior
    expect(p.confident).toBe(false);
  });

  it("prefers the specific right when one is named", () => {
    const data = [
      ...claims(300, 0.2, 10_000, 20),
      ...claims(300, 0.9, 80_000, 20, { rightId: "arnona_senior" }),
    ];
    const p = predictOutcome({ ...IL, rightId: "arnona_senior" }, data);
    expect(p.evidence.level).toBe("right");
    expect(p.paidProbability).toBeGreaterThan(0.7);
    expect(p.expectedAmountMinor).toBe(80_000);
  });
});

describe("ranking is by money, not by odds", () => {
  it("puts a valuable long shot above a worthless certainty", () => {
    const data = [
      ...claims(400, 0.95, 4_000, 10, { counterparty: "easy" }),
      ...claims(400, 0.4, 400_000, 60, { counterparty: "big" }),
    ];
    const ranked = rankByExpectedValue(
      [
        { market: "IL", vertical: "arnona", counterparty: "easy" },
        { market: "IL", vertical: "arnona", counterparty: "big" },
      ],
      data,
    );
    // 0.95 x 4,000 = 3,800 against 0.4 x 400,000 = 160,000.
    expect(ranked[0].query.counterparty).toBe("big");
  });
});

// ---------------------------------------------------------------------------
// Calibration — the property that makes the numbers sellable
// ---------------------------------------------------------------------------

describe("calibration measurement", () => {
  it("scores a perfect forecaster at zero and a reversed one at one", () => {
    const perfect: Forecast[] = [
      { predicted: 1, outcome: true },
      { predicted: 0, outcome: false },
    ];
    const reversed: Forecast[] = [
      { predicted: 0, outcome: true },
      { predicted: 1, outcome: false },
    ];
    expect(brierScore(perfect)).toBe(0);
    expect(brierScore(reversed)).toBe(1);
  });

  it("catches a model that is accurate but overconfident", () => {
    // Says 0.95 every time, is right 70% of the time. Accuracy looks fine;
    // this is exactly the failure that costs money in aggregate.
    const forecasts: Forecast[] = Array.from({ length: 1000 }, (_, i) => ({
      predicted: 0.95,
      outcome: i < 700,
    }));
    const report = assessCalibration(forecasts);
    expect(report.ece).toBeGreaterThan(0.2);
    expect(report.verdict).toBe("unreliable");
    expect(report.summary).toMatch(/do not price on them/);
  });

  it("passes a genuinely calibrated forecaster", () => {
    // Outcomes generated from the stated probabilities: calibrated by
    // construction, so the measurement had better agree.
    const rng = seededRng(11);
    const forecasts: Forecast[] = Array.from({ length: 4000 }, () => {
      const predicted = Math.round(rng() * 100) / 100;
      return { predicted, outcome: rng() < predicted };
    });
    const report = assessCalibration(forecasts);
    expect(report.ece).toBeLessThan(0.05);
    expect(report.verdict).toBe("priceable");
  });

  it("separates 'good enough to advise' from 'good enough to underwrite'", () => {
    const rng = seededRng(5);
    // Mildly overconfident: shifted about 7 points.
    const forecasts: Forecast[] = Array.from({ length: 2000 }, () => {
      const predicted = 0.3 + rng() * 0.6;
      return { predicted, outcome: rng() < predicted - 0.07 };
    });
    const report = assessCalibration(forecasts);
    expect(report.verdict).toBe("usable");
    expect(report.summary).toMatch(/not good enough to underwrite/);
  });

  it("says nothing at all on too little data, rather than something wrong", () => {
    const report = assessCalibration([{ predicted: 0.9, outcome: true }]);
    expect(report.verdict).toBe("insufficient_data");
    expect(report.summary).toMatch(/itself noise/);
  });

  it("rewards beating the base rate and punishes failing to", () => {
    const informative: Forecast[] = [
      ...Array.from({ length: 500 }, () => ({ predicted: 0.9, outcome: true })),
      ...Array.from({ length: 500 }, () => ({ predicted: 0.1, outcome: false })),
    ];
    expect(skillScore(informative)).toBeGreaterThan(0.8);

    const useless: Forecast[] = Array.from({ length: 1000 }, (_, i) => ({
      predicted: 0.5,
      outcome: i % 2 === 0,
    }));
    expect(skillScore(useless)).toBeCloseTo(0, 2);
  });

  it("shows the shape, so overconfidence at the top end is visible", () => {
    const forecasts: Forecast[] = [
      ...Array.from({ length: 100 }, () => ({ predicted: 0.95, outcome: false })),
      ...Array.from({ length: 100 }, () => ({ predicted: 0.05, outcome: false })),
    ];
    const curve = reliabilityCurve(forecasts);
    const top = curve[curve.length - 1];
    expect(top.count).toBe(100);
    expect(top.meanPredicted).toBeCloseTo(0.95, 2);
    expect(top.observedRate).toBe(0); // promised almost certain, delivered never
    expect(expectedCalibrationError(forecasts)).toBeGreaterThan(0.4);
  });

  it("handles an empty history without inventing a grade", () => {
    expect(brierScore([])).toBe(0);
    expect(expectedCalibrationError([])).toBe(0);
    expect(assessCalibration([]).verdict).toBe("insufficient_data");
  });
});

describe("the Oracle's own forecasts hold up when measured", () => {
  it("is calibrated on held-out claims it has never seen", () => {
    const rng = seededRng(2026);
    // Twelve counterparties with genuinely different, unknown-to-the-model rates.
    const parties = Array.from({ length: 12 }, (_, i) => ({
      id: `cp_${i}`,
      trueRate: 0.15 + (i / 12) * 0.7,
    }));

    const history: ClaimObservation[] = [];
    for (const p of parties) {
      for (let i = 0; i < 300; i++) {
        history.push({
          market: "IL",
          vertical: "arnona",
          counterparty: p.id,
          paid: rng() < p.trueRate,
          recoveredMinor: 20_000,
          days: 20,
        });
      }
    }

    // Predict, then draw fresh outcomes from the true rates and grade.
    const forecasts: Forecast[] = [];
    for (const p of parties) {
      const prediction = predictOutcome(
        { market: "IL", vertical: "arnona", counterparty: p.id },
        history,
      );
      for (let i = 0; i < 200; i++) {
        forecasts.push({ predicted: prediction.paidProbability, outcome: rng() < p.trueRate });
      }
    }

    const report = assessCalibration(forecasts);
    expect(report.samples).toBe(2400);
    expect(report.ece).toBeLessThan(0.05);
    expect(report.skill).toBeGreaterThan(0);
    expect(report.verdict).toBe("priceable");
  });
});
