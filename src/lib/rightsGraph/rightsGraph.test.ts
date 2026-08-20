import { describe, expect, it } from "vitest";
import {
  RightSchema,
  evaluatePredicate,
  evaluateRemedyMinor,
  isValidFormula,
  rightApplies,
  type CaseFacts,
  type Predicate,
} from "./schema";
import {
  RIGHTS,
  DraftRightError,
  getRight,
  rightForLetter,
  verifiedRights,
} from "./registry";
import { cancelTeethClauseHe } from "@/lib/legalTeeth";

// ---------------------------------------------------------------------------
// Predicate evaluator
// ---------------------------------------------------------------------------

describe("evaluatePredicate", () => {
  const facts: CaseFacts = {
    amount_minor: 4500,
    provider: "chishuvit",
    tags: ["telecom", "vip"],
    cancelled: true,
    empty: null,
  };

  it("compares scalars with every op", () => {
    expect(evaluatePredicate({ kind: "fact", field: "cancelled", op: "eq", value: true }, facts)).toBe(true);
    expect(evaluatePredicate({ kind: "fact", field: "provider", op: "neq", value: "other" }, facts)).toBe(true);
    expect(evaluatePredicate({ kind: "fact", field: "amount_minor", op: "gt", value: 4000 }, facts)).toBe(true);
    expect(evaluatePredicate({ kind: "fact", field: "amount_minor", op: "gte", value: 4500 }, facts)).toBe(true);
    expect(evaluatePredicate({ kind: "fact", field: "amount_minor", op: "lt", value: 4500 }, facts)).toBe(false);
    expect(evaluatePredicate({ kind: "fact", field: "amount_minor", op: "lte", value: 4499 }, facts)).toBe(false);
  });

  it("handles includes for arrays and substrings", () => {
    expect(evaluatePredicate({ kind: "fact", field: "tags", op: "includes", value: "vip" }, facts)).toBe(true);
    expect(evaluatePredicate({ kind: "fact", field: "provider", op: "includes", value: "chi" }, facts)).toBe(true);
    expect(evaluatePredicate({ kind: "fact", field: "tags", op: "includes", value: "none" }, facts)).toBe(false);
  });

  it("fails closed on missing or null facts — a right never applies by omission", () => {
    expect(evaluatePredicate({ kind: "fact", field: "missing", op: "eq", value: 1 }, facts)).toBe(false);
    expect(evaluatePredicate({ kind: "fact", field: "empty", op: "eq", value: null as never }, facts)).toBe(false);
    expect(evaluatePredicate({ kind: "fact", field: "empty", op: "exists" }, facts)).toBe(false);
    expect(evaluatePredicate({ kind: "fact", field: "amount_minor", op: "exists" }, facts)).toBe(true);
  });

  it("refuses numeric comparisons on non-numbers instead of coercing", () => {
    expect(evaluatePredicate({ kind: "fact", field: "provider", op: "gt", value: 0 }, facts)).toBe(false);
  });

  it("composes with all / any / not", () => {
    const p: Predicate = {
      kind: "all",
      of: [
        { kind: "fact", field: "cancelled", op: "eq", value: true },
        {
          kind: "any",
          of: [
            { kind: "fact", field: "amount_minor", op: "gt", value: 100_000 },
            { kind: "fact", field: "tags", op: "includes", value: "telecom" },
          ],
        },
        { kind: "not", of: { kind: "fact", field: "missing", op: "exists" } },
      ],
    };
    expect(evaluatePredicate(p, facts)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Remedy formulas — evaluated, never generated
// ---------------------------------------------------------------------------

describe("remedy formulas", () => {
  it("accepts exactly the two shapes and nothing else", () => {
    expect(isValidFormula("min(overcharge_total, cap)")).toBe(true);
    expect(isValidFormula("estimated_refund_minor")).toBe(true);
    expect(isValidFormula("overcharge * 2")).toBe(false);
    expect(isValidFormula("min(a, b)")).toBe(false); // cap keyword only
    expect(isValidFormula("eval(x)")).toBe(false);
  });

  it("evaluates min(fact, cap) in minor units", () => {
    const remedy = { formula: "min(overcharge_total, cap)", capMinor: 1_000_000 };
    expect(evaluateRemedyMinor(remedy, { overcharge_total: 250_000 })).toBe(250_000);
    expect(evaluateRemedyMinor(remedy, { overcharge_total: 5_000_000 })).toBe(1_000_000);
  });

  it("returns null — never an invented number — when the fact is absent or invalid", () => {
    const remedy = { formula: "min(overcharge_total, cap)", capMinor: 1_000_000 };
    expect(evaluateRemedyMinor(remedy, {})).toBeNull();
    expect(evaluateRemedyMinor(remedy, { overcharge_total: -5 })).toBeNull();
    expect(evaluateRemedyMinor(remedy, { overcharge_total: "x" as never })).toBeNull();
  });

  it("falls back to the statutory cap when there is no formula", () => {
    expect(evaluateRemedyMinor({ capMinor: 1_000_000 }, {})).toBe(1_000_000);
    expect(evaluateRemedyMinor({}, {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Registry — every entry validates; verified means sourced
// ---------------------------------------------------------------------------

describe("registry", () => {
  it("every registered right passes the schema", () => {
    for (const right of RIGHTS) {
      const parsed = RightSchema.safeParse(right);
      expect(parsed.success, `${right.id}: ${JSON.stringify(parsed.success ? "" : parsed.error.issues)}`).toBe(true);
    }
  });

  it("every verified right carries a real source URL and a human verification date", () => {
    for (const right of verifiedRights()) {
      expect(right.statute.sourceUrl).toMatch(/^https:\/\//);
      expect(right.statute.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(right.todoSource).toBeUndefined();
    }
  });

  it("ids are unique", () => {
    const ids = RIGHTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the 31a right applies exactly when the statutory facts hold", () => {
    const right = getRight("il.consumer.31a.continued-billing-after-cancellation")!;
    const qualifying: CaseFacts = {
      continuing_transaction: true,
      written_cancellation_sent: true,
      charged_after_cancellation: true,
    };
    expect(rightApplies(right, qualifying)).toBe(true);
    // No written notice → no 31a(b) position → the right must not claim to apply.
    expect(
      rightApplies(right, { ...qualifying, written_cancellation_sent: false }),
    ).toBe(false);
    expect(rightApplies(right, {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The draft gate — the Phase 1 acceptance test: draft law cannot reach letters
// ---------------------------------------------------------------------------

describe("rightForLetter — draft law never reaches a letter", () => {
  it("returns a verified right", () => {
    const right = rightForLetter("il.consumer.31a.continued-billing-after-cancellation");
    expect(right.status).toBe("verified");
    expect(right.remedy.capMinor).toBe(1_000_000);
  });

  it("throws DraftRightError for a draft right", () => {
    expect(() => rightForLetter("il.banking.tax.credit-points-unused")).toThrow(DraftRightError);
  });

  it("throws for an unknown right rather than inventing one", () => {
    expect(() => rightForLetter("il.consumer.made-up")).toThrow(DraftRightError);
  });

  it("is load-bearing for a real letter path: the cancel clause resolves through it", () => {
    // cancelTeethClauseHe() derives the law name and the ₪10,000 cap from the
    // graph via rightForLetter(). If the 31a entry were flipped to draft,
    // this call would throw — asserted indirectly here by it both succeeding
    // AND carrying the graph's values verbatim.
    const clause = cancelTeethClauseHe();
    expect(clause).toContain('חוק הגנת הצרכן, התשמ"א-1981');
    expect(clause).toContain("10,000");
  });
});
