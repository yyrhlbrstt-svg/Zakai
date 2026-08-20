import "server-only";
import { UNKNOWN_DRAFTER } from "@/lib/ai/drafterId";
import { prisma } from "@/lib/prisma";
import { selectVariant, seededRng } from "./selector";
import { VARIANTS, describeVariant, variantById } from "./variants";
import { isCatalogVariantId } from "./normalizeKeys";
import { MIN_COHORT_TRIALS } from "./learningInsights";
import type { Observation, Selection, StrategyContext } from "./types";

/**
 * The database side of the Strategy Engine — the part that makes the flywheel
 * actually turn.
 *
 * Two calls, at the two ends of a case's life:
 *
 *   chooseStance()  — before drafting, pick how to file this one
 *   recordOutcome() — when it closes, feed back what happened
 *
 * Without both, the engine is a dashboard again.
 *
 * Everything here fails open. A claim must never be blocked because the
 * evidence table is slow or unreachable: the cost of that failure is a
 * customer's letter not going out, against the benefit of a marginally better
 * stance. So on any error the caller gets the default stance and the case
 * proceeds exactly as it did before this engine existed.
 */

/** How many recent observations inform a choice. Bounded so the query stays cheap. */
const EVIDENCE_WINDOW = 5000;

/**
 * The stance used when nothing can be loaded. `firm_statutory` rather than the
 * softest option: citing the statute and asking for a reply by a date is the
 * baseline a consumer body would consider competent, and an unmeasured default
 * should be defensible rather than merely inoffensive.
 */
export const DEFAULT_VARIANT_ID = "firm_statutory";

export interface Stance {
  variantId: string;
  seed: number;
  /** Instructions handed to the drafting model. */
  instructions: string[];
  evidenceLevel: Selection["evidenceLevel"];
  trials: number;
}

function stanceFrom(variantId: string, seed: number, level: Stance["evidenceLevel"], trials: number): Stance {
  const variant = variantById(variantId) ?? variantById(DEFAULT_VARIANT_ID)!;
  return {
    variantId: variant.id,
    seed,
    instructions: describeVariant(variant),
    evidenceLevel: level,
    trials,
  };
}

/**
 * Choose how to file this claim, from what has actually been getting paid.
 *
 * The seed is drawn here and returned so it can be stored on the case: the
 * selection is then reproducible from (seed + observations), which is what
 * makes "why did this customer get this letter" an answerable question rather
 * than an appeal to a model's mood.
 */
export async function chooseStance(context: StrategyContext): Promise<Stance> {
  const seed = (Math.random() * 2 ** 31) >>> 0;
  try {
    const rows = await prisma.strategyOutcome.findMany({
      where: { market: context.market },
      orderBy: { createdAt: "desc" },
      take: EVIDENCE_WINDOW,
      select: {
        market: true,
        vertical: true,
        counterparty: true,
        variantId: true,
        paid: true,
        recoveredMinor: true,
        days: true,
        selfReported: true,
      },
    });

    // Verified-first: self-reports fill only when the verified pool is thin
    // (same rule as cohortLearning). Drop non-catalog variantIds.
    const catalog = rows.filter((r) => isCatalogVariantId(r.variantId));
    const verified = catalog.filter((r) => !r.selfReported);
    const pool = verified.length >= MIN_COHORT_TRIALS ? verified : catalog;
    const observations: Observation[] = pool.map((r) => ({
      context: { market: r.market, vertical: r.vertical, counterparty: r.counterparty },
      variantId: r.variantId,
      paid: r.paid,
      recoveredMinor: r.recoveredMinor,
      days: r.days,
    }));

    const picked = selectVariant(VARIANTS, observations, context, { rng: seededRng(seed) });
    return stanceFrom(picked.variant.id, seed, picked.evidenceLevel, picked.trials);
  } catch (err) {
    console.warn("[strategy] falling back to the default stance:", err);
    return stanceFrom(DEFAULT_VARIANT_ID, seed, "prior", 0);
  }
}

/**
 * Record what a closed case taught us.
 *
 * Called for successes *and* failures. Recording only wins is the mistake that
 * quietly destroys the dataset: a variant's win rate is meaningless without its
 * losses, and a system trained on wins alone concludes everything works.
 */
export async function recordOutcome(input: {
  context: StrategyContext;
  variantId: string | null;
  /**
   * Model that wrote the draft, as "provider:model". Null/absent for cases
   * drafted before attribution existed and for the deterministic template —
   * both stored as UNKNOWN_DRAFTER so they stay countable and can never be
   * quietly credited to whichever model happens to be configured now.
   */
  drafterId?: string | null;
  /** True when a signed settlement backs this outcome. */
  settlementBacked?: boolean;
  paid: boolean;
  recoveredMinor: number;
  days: number;
  /** True when the person told us, rather than the pipeline observing it. */
  selfReported?: boolean;
  /**
   * The documented before-amount the demand was built on, minor units — the
   * denominator that makes the outcome priceable. Absent when no documented
   * amount exists; never guessed.
   */
  claimBasisMinor?: number | null;
  /** "letter" | "followup" — how far the ladder actually went (from Outbox). */
  escalationStage?: string | null;
  /** Rights Graph right the letters invoked, when the vertical maps to one. */
  rightId?: string | null;
}): Promise<void> {
  // Cases opened before the engine carry no stance; attributing them to a
  // variant would be inventing evidence.
  if (!input.variantId) return;
  try {
    await prisma.strategyOutcome.create({
      data: {
        market: input.context.market,
        vertical: input.context.vertical,
        counterparty: input.context.counterparty,
        variantId: input.variantId,
        drafterId: input.drafterId || UNKNOWN_DRAFTER,
        settlementBacked: input.settlementBacked === true,
        paid: input.paid,
        recoveredMinor: Math.max(0, Math.round(input.recoveredMinor)),
        days: Math.max(0, Math.round(input.days)),
        selfReported: input.selfReported === true,
        claimBasisMinor:
          typeof input.claimBasisMinor === "number" && input.claimBasisMinor > 0
            ? Math.round(input.claimBasisMinor)
            : null,
        escalationStage: input.escalationStage?.trim() || null,
        rightId: input.rightId?.trim() || null,
      },
    });
  } catch (err) {
    // Never let bookkeeping break a settlement the customer is waiting on.
    console.warn("[strategy] could not record outcome:", err);
  }
}

/** Whole days between two instants, floored at zero. */
export function daysBetween(from: Date | null | undefined, to: Date): number {
  if (!from) return 0;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}


/**
 * What a person told us happened after they sent one of our letters.
 *
 * THE GAP THIS CLOSES
 *
 * Until now the outcome graph could only be written by the full case pipeline —
 * an account, ownership verification, an authorization, a provider reply. Every
 * letter the entitlement, captive, incident and dormant paths produce went out
 * and taught us nothing, which meant the one asset that compounds was gated
 * behind the heaviest flow in the product and was therefore empty.
 *
 * A self-report needs none of that: no account, no case, one tap. It is how the
 * graph becomes non-empty on day one, and it is the only version that does not
 * depend on an institution integrating anything first.
 *
 * WHY IT IS MARKED AND NOT MERGED
 *
 * It is weaker evidence and pretending otherwise would be the expensive kind of
 * wrong. A verified case carries a provider reply and a documented saving; a
 * self-report carries somebody's recollection, with the selection bias that
 * people who got paid are likelier to come back and say so. Both are real. They
 * are not interchangeable, and a reader that averages them without knowing is a
 * reader making a confident claim on a number it does not understand.
 *
 * So the row is flagged, and the decision is pushed to each consumer: pricing
 * excludes it, ranking includes it. See the readers for why.
 *
 * DE-IDENTIFIED BY CONSTRUCTION
 *
 * The table has no user or case foreign key and this function takes neither.
 * There is nothing here to link a row to a person even with the database in
 * hand — which is the point, and is why this can be accepted from an
 * unauthenticated caller at all.
 */
export async function recordSelfReport(input: {
  context: StrategyContext;
  variantId: string;
  paid: boolean;
  recoveredMinor: number;
  days: number;
}): Promise<void> {
  await recordOutcome({ ...input, selfReported: true });
}
