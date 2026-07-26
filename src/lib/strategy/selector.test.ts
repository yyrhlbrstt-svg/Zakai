import { describe, expect, it } from "vitest";
import {
  buildPosteriors,
  rankVariants,
  sampleBeta,
  seededRng,
  selectVariant,
} from "./selector";
import { VARIANTS, describeVariant, variantById } from "./variants";
import type { Observation, StrategyContext } from "./types";

const IL_TELECOM: StrategyContext = {
  market: "IL",
  vertical: "telecom",
  counterparty: "cellcom",
};

function obs(
  variantId: string,
  paid: boolean,
  recoveredMinor: number,
  context: StrategyContext = IL_TELECOM,
  days = 21,
): Observation {
  return { context, variantId, paid, recoveredMinor, days };
}

/** n observations of a variant with a given win rate and payout. */
function history(
  variantId: string,
  n: number,
  winRate: number,
  amount: number,
  context: StrategyContext = IL_TELECOM,
): Observation[] {
  return Array.from({ length: n }, (_, i) =>
    obs(variantId, i < Math.round(n * winRate), amount, context),
  );
}

/** How often each variant is chosen over many independent draws. */
function drawCounts(observations: Observation[], context = IL_TELECOM, draws = 600) {
  const counts = new Map<string, number>();
  for (let i = 0; i < draws; i++) {
    const pick = selectVariant(VARIANTS, observations, context, { rng: seededRng(i + 1) });
    counts.set(pick.variant.id, (counts.get(pick.variant.id) ?? 0) + 1);
  }
  return counts;
}

describe("the sampler", () => {
  it("draws Beta values in range and centred on the right mean", () => {
    const rng = seededRng(42);
    const draws = Array.from({ length: 4000 }, () => sampleBeta(rng, 8, 2));
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...draws)).toBeLessThanOrEqual(1);
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(mean).toBeGreaterThan(0.75);
    expect(mean).toBeLessThan(0.85); // true mean 8/10
  });

  it("handles shape parameters below one", () => {
    const rng = seededRng(7);
    const draws = Array.from({ length: 500 }, () => sampleBeta(rng, 0.4, 0.6));
    expect(draws.every((d) => d >= 0 && d <= 1 && Number.isFinite(d))).toBe(true);
  });

  it("is reproducible from a seed", () => {
    const draw = () => {
      const rng = seededRng(9);
      return Array.from({ length: 20 }, () => sampleBeta(rng, 3, 4));
    };
    const a = draw();
    const b = draw();
    expect(a).toEqual(b);
    // Guard against the trivially-passing version of this test: the values
    // must be real, distinct numbers rather than a list of undefined.
    expect(a.every((x) => typeof x === "number" && x > 0 && x < 1)).toBe(true);
    expect(new Set(a).size).toBeGreaterThan(15);
  });
});

describe("cold start", () => {
  it("says plainly that it is running on a prior, not on evidence", () => {
    const pick = selectVariant(VARIANTS, [], IL_TELECOM, { rng: seededRng(1) });
    expect(pick.evidenceLevel).toBe("prior");
    expect(pick.trials).toBe(0);
  });

  it("still explores the whole space when it knows nothing", () => {
    const counts = drawCounts([]);
    expect(counts.size).toBeGreaterThan(3);
  });

  it("never returns a variant that is not a candidate", () => {
    for (let i = 0; i < 100; i++) {
      const pick = selectVariant(VARIANTS, [], IL_TELECOM, { rng: seededRng(i) });
      expect(variantById(pick.variant.id)).toBeDefined();
    }
  });

  it("refuses to choose from an empty candidate set rather than returning null", () => {
    expect(() => selectVariant([], [], IL_TELECOM)).toThrow(/no candidate/);
  });
});

describe("it learns", () => {
  const learned = [
    ...history("cooperative_plain", 120, 0.2, 8_000),
    ...history("firm_statutory", 120, 0.7, 9_000),
  ];

  it("converges on the approach that actually gets paid", () => {
    const counts = drawCounts(learned);
    const firm = counts.get("firm_statutory") ?? 0;
    const weak = counts.get("cooperative_plain") ?? 0;
    expect(firm).toBeGreaterThan(weak * 5);
  });

  it("keeps exploring rather than freezing on the leader", () => {
    const counts = drawCounts(learned);
    expect(counts.size).toBeGreaterThan(1);
    expect(counts.get("firm_statutory")).toBeLessThan(600);
  });

  it("reports which draws were exploratory", () => {
    const picks = Array.from({ length: 200 }, (_, i) =>
      selectVariant(VARIANTS, learned, IL_TELECOM, { rng: seededRng(i + 1) }),
    );
    expect(picks.some((p) => p.exploring)).toBe(true);
    expect(picks.some((p) => !p.exploring)).toBe(true);
  });

  it("reports the evidence as coming from this counterparty once it exists", () => {
    const pick = selectVariant(VARIANTS, learned, IL_TELECOM, { deterministic: true });
    expect(pick.evidenceLevel).toBe("counterparty");
    expect(pick.trials).toBe(120);
  });
});

describe("it optimises recovered money, not win rate", () => {
  // The trap: 90% × ₪20 looks like a triumph and 50% × ₪200 looks mediocre.
  // Expected recovery is 18 against 100.
  const observations = [
    ...history("cooperative_plain", 200, 0.9, 2_000),
    ...history("formal_escalation", 200, 0.5, 20_000),
  ];

  it("prefers the lower win rate that returns more money", () => {
    const pick = selectVariant(VARIANTS, observations, IL_TELECOM, { deterministic: true });
    expect(pick.variant.id).toBe("formal_escalation");
  });

  it("ranks by expected recovery so the operator sees the same logic", () => {
    const ranked = rankVariants(VARIANTS, observations, IL_TELECOM);
    expect(ranked[0].variantId).toBe("formal_escalation");
    const winner = ranked.find((r) => r.variantId === "formal_escalation")!;
    const loser = ranked.find((r) => r.variantId === "cooperative_plain")!;
    expect(winner.expectedMinor).toBeGreaterThan(loser.expectedMinor * 3);
  });

  it("chooses it in the overwhelming majority of sampled draws too", () => {
    const counts = drawCounts(observations);
    expect(counts.get("formal_escalation") ?? 0).toBeGreaterThan(500);
  });
});

describe("hierarchical backoff — the cold-cell problem", () => {
  const partner: StrategyContext = { ...IL_TELECOM, counterparty: "partner" };

  it("uses vertical evidence when the counterparty is new", () => {
    const observations = history("firm_statutory", 80, 0.8, 9_000, IL_TELECOM);
    const pick = selectVariant(VARIANTS, observations, partner, { deterministic: true });
    expect(pick.variant.id).toBe("firm_statutory");
    expect(pick.evidenceLevel).toBe("vertical");
  });

  it("lets real local evidence outweigh borrowed evidence", () => {
    const observations = [
      // Strong vertical-level signal for one approach...
      ...history("firm_statutory", 200, 0.9, 9_000, IL_TELECOM),
      // ...but against this counterparty specifically it fails, and another works.
      ...history("firm_statutory", 40, 0.05, 9_000, partner),
      ...history("cooperative_plain", 40, 0.8, 9_000, partner),
    ];
    const pick = selectVariant(VARIANTS, observations, partner, { deterministic: true });
    expect(pick.variant.id).toBe("cooperative_plain");
    expect(pick.evidenceLevel).toBe("counterparty");
  });

  it("borrows across verticals within a market, at a discount", () => {
    const otherVertical: StrategyContext = { market: "IL", vertical: "bank-fees", counterparty: "leumi" };
    const observations = history("formal_escalation", 300, 0.9, 30_000, IL_TELECOM);
    const posteriors = buildPosteriors(VARIANTS, observations, otherVertical);
    const p = posteriors.find((x) => x.variantId === "formal_escalation")!;
    expect(p.evidenceLevel).toBe("market");
    // Discounted twice (vertical → market), so nowhere near 270 wins.
    expect(p.alpha).toBeLessThan(30);
    expect(p.alpha).toBeGreaterThan(1);
  });
});

describe("evidence never crosses a border", () => {
  it("ignores Israeli observations when filing in Britain", () => {
    const observations = history("formal_escalation", 300, 0.95, 50_000, IL_TELECOM);
    const gb: StrategyContext = { market: "GB", vertical: "telecom", counterparty: "bt" };
    const posteriors = buildPosteriors(VARIANTS, observations, gb);
    for (const p of posteriors) {
      expect(p.evidenceLevel).toBe("prior");
      expect(p.alpha).toBe(1);
      expect(p.beta).toBe(1);
    }
  });
});

describe("reproducibility and the audit question", () => {
  it("gives the same answer from the same seed and observations", () => {
    const observations = history("firm_statutory", 50, 0.6, 9_000);
    const a = selectVariant(VARIANTS, observations, IL_TELECOM, { rng: seededRng(1234) });
    const b = selectVariant(VARIANTS, observations, IL_TELECOM, { rng: seededRng(1234) });
    expect(a.variant.id).toBe(b.variant.id);
  });

  it("deterministic mode files every claim identically, for regulated verticals", () => {
    const observations = history("firm_statutory", 50, 0.6, 9_000);
    const picks = new Set(
      Array.from({ length: 50 }, () =>
        selectVariant(VARIANTS, observations, IL_TELECOM, { deterministic: true }).variant.id,
      ),
    );
    expect(picks.size).toBe(1);
  });
});

describe("the measured stance and the written instruction cannot drift", () => {
  it("describes every dimension of every variant", () => {
    for (const v of VARIANTS) {
      const lines = describeVariant(v);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.every((l) => l.trim().endsWith("."))).toBe(true);
      if (v.citesStatute) expect(lines.join(" ")).toMatch(/statute|regulation/i);
      if (v.namesEscalation) expect(lines.join(" ")).toMatch(/refused/i);
    }
  });

  it("has a unique id per variant", () => {
    expect(new Set(VARIANTS.map((v) => v.id)).size).toBe(VARIANTS.length);
  });

  it("carries no personal data into an observation", () => {
    const record = obs("firm_statutory", true, 9_000);
    expect(Object.keys(record).sort()).toEqual(["context", "days", "paid", "recoveredMinor", "variantId"]);
    expect(Object.keys(record.context).sort()).toEqual(["counterparty", "market", "vertical"]);
  });
});
