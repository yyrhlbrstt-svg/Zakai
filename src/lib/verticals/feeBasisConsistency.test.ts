import { describe, expect, it } from "vitest";
import { RULE_PACKS } from "./packs";
import type { VerificationMethod } from "./types";

/**
 * The fee basis has to match what actually changed.
 *
 * `computeCaseSuccessFee` reads `feeBasis` and nothing else. A one-time
 * recovery billed as `monthly` charges 18% of a single month of a saving that
 * was never monthly — on a ₪3,000 deposit that is the difference between ₪540
 * and a number that makes no sense. A recurring reduction billed as `lump`
 * charges 18% of an annualised figure as though it landed at once.
 *
 * Nothing checked this. The basis is a hand-written field on each pack, and
 * the only thing tying it to reality was whoever wrote the pack remembering
 * which kind of money it was.
 *
 * WHY THE VERIFICATION METHOD IS THE RIGHT ANCHOR
 *
 * It describes what the pipeline actually observes when the money comes back,
 * so it is the one field that cannot be wrong without the whole vertical
 * being wrong. If proof is "the next bill is lower" the saving recurs; if
 * proof is "a transfer landed" it happened once.
 */

/** Methods that settle the question on their own. */
const IMPLIES_BASIS: Partial<Record<VerificationMethod, "monthly" | "lump">> = {
  // The proof is a bill that keeps arriving, smaller.
  before_after_bill: "monthly",
  // The proof is a recurring charge that stops recurring.
  statement_line_gone: "monthly",
  // The proof is money arriving once.
  transfer_confirmation: "lump",
};

/**
 * `decision_letter` and `manual` genuinely do not settle it: an authority's
 * decision can lower a recurring bill or order a one-time refund, and both
 * are real. Those packs must say which, in writing, rather than be guessed
 * at by a rule that would be wrong about half of them.
 */
const AMBIGUOUS_METHOD_REASONS: Record<string, string> = {
  parking:
    "The appeal decision cancels a single fine that was already issued, so the money is a one-time cancellation rather than a bill that keeps arriving.",
  "transport-fine":
    "Same shape as parking: one fine, one decision, one amount cancelled.",
  arnona:
    "A successful arnona objection corrects the property's classification or area, which lowers every future bill — the recurring case, not a one-off refund.",
  warranty:
    "The decision grants a repair, replacement or refund against one purchase. Nothing recurs.",
  "toll-dispute":
    "The operator's decision cancels a single toll charge that was already levied. Nothing recurs; the amount either stands or it does not.",
  "water-bill":
    "A concealed-leak discount is a credit against consumption already billed, granted once for the leak period. The ongoing tariff is unchanged.",
  "vaad-bait":
    "The committee either corrects a specific charge already made or refunds it. Any recurring change to the building's levy is a separate decision by the residents, not this claim.",
  "collection-complaint":
    "The outcome is a debt cancelled, reduced or confirmed once. There is no recurring bill here to make smaller.",
  "car-insurance-refund":
    "Cancelling mid-term returns the unused portion of a premium already paid. It is a single settlement.",
};

describe("a pack's fee basis matches what it actually observes", () => {
  it.each(RULE_PACKS.map((p) => [p.key, p] as const))(
    "%s bills the kind of money it proves",
    (key, pack) => {
      const implied = IMPLIES_BASIS[pack.verification.method];
      if (!implied) return; // handled by the ambiguity test below
      expect(
        pack.feeBasis,
        `${key} proves the recovery with "${pack.verification.method}", which means the money is ` +
          `${implied}, but it bills as "${pack.feeBasis}"`,
      ).toBe(implied);
    },
  );

  it("every pack whose proof does not settle the basis says why in writing", () => {
    const unexplained = RULE_PACKS.filter((p) => !IMPLIES_BASIS[p.verification.method])
      .filter((p) => !(p.key in AMBIGUOUS_METHOD_REASONS))
      .map((p) => `${p.key} (${p.verification.method} → ${p.feeBasis})`);

    expect(
      unexplained,
      unexplained.length
        ? `A decision letter can grant a recurring reduction or a one-time refund, and this pack ` +
            `does not say which:\n  ${unexplained.join("\n  ")}`
        : "",
    ).toEqual([]);
  });

  it("does not keep a reason for a pack that no longer needs one", () => {
    // An explanation that outlives its pack rots the list until nobody reads
    // it — the same failure one layer up.
    const keys = new Set(RULE_PACKS.map((p) => p.key));
    const ambiguous = new Set(
      RULE_PACKS.filter((p) => !IMPLIES_BASIS[p.verification.method]).map((p) => p.key),
    );
    for (const key of Object.keys(AMBIGUOUS_METHOD_REASONS)) {
      expect(keys.has(key), `${key} is not a registered pack — remove its reason`).toBe(true);
      expect(
        ambiguous.has(key),
        `${key}'s proof now settles the basis on its own — remove its reason`,
      ).toBe(true);
    }
  });

  it("gives a real reason, not a placeholder", () => {
    for (const [key, reason] of Object.entries(AMBIGUOUS_METHOD_REASONS)) {
      expect(reason.trim().length, `${key} needs a real reason`).toBeGreaterThan(60);
    }
  });

  it("covers every pack, so the check cannot pass by measuring nothing", () => {
    // A registry that failed to load would make every assertion above vacuous.
    expect(RULE_PACKS.length).toBeGreaterThanOrEqual(15);
  });
});
