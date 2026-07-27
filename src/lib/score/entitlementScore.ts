/**
 * The Zakai Score — how much of what you are owed you are actually collecting.
 *
 * NOT the same thing as `moneyScore.ts`, and the difference is the point.
 * Money Health Score measures engagement with the app: checks run, plan tier,
 * referrals made, days since last visit. Upgrading your subscription raises it.
 * That is a loyalty score wearing a financial costume, and it cannot be the
 * number this product is built around — a score that goes up when you pay us
 * is not a measurement, it is a nudge.
 *
 * This measures the user's money instead: of everything you are entitled to,
 * what fraction have you actually captured? It goes up when money reaches you
 * and for no other reason. It is unaffected by which plan you are on.
 *
 * THE INVERSION WORTH NOTICING
 *
 * A credit score rates the person, for the institution's benefit — it exists so
 * a lender can decide about you. This rates how much money is being left on
 * your table, for your benefit. Same familiar shape, opposite direction of
 * service. That is the whole positioning of the product expressed as a single
 * number, and it is why the number is worth paying for: nobody else will ever
 * build it, because everybody else in this market is paid by the institution.
 *
 * ZERO EFFORT BY CONSTRUCTION
 *
 * The inputs are: a short household profile the user already knows without
 * looking anything up, and what Zakai has already done for them. No receipts to
 * photograph, no statements to upload, no bank connection. Anything that
 * requires the user to go and find a document cannot be an input to the first
 * number they ever see, because most people will not go and find it.
 *
 * WHAT IT REFUSES TO DO
 *
 * Many entitlements have no honest headline value — they depend on income,
 * household, municipality. The codebase already marks those "varies" rather
 * than inventing a figure, and that discipline has to survive into the score.
 * So money and coverage are tracked separately: the shekel figure sums only
 * what can be stood behind, while unquantified rights still count toward
 * coverage. A score that quietly invents ₪400 to look impressive is the same
 * failure as a rights list that promises a service it does not have.
 */

/** One entitlement the person qualifies for, as the rights engine reports it. */
export interface ScorableRight {
  id: string;
  /** Recurring annual value in minor units, when honestly quantifiable. */
  yearlyMinor?: number;
  /** One-off value in minor units, when honestly quantifiable. */
  oneTimeMinor?: number;
}

export interface EntitlementScoreInput {
  /** Everything the profile says this person qualifies for. */
  eligible: readonly ScorableRight[];
  /** Rights they have actually acted on — a claim filed or a tool completed. */
  actedOn: readonly string[];
  /** Rights with money documented back, a strict subset of actedOn in practice. */
  recovered: readonly string[];
  /** Documented recovery in minor units, from the savings ledger — never self-reported. */
  recoveredMinor: number;
  /** 0..1 — how much of the profile has been answered. */
  profileCompleteness: number;
}

export type ScoreBand = "leaking" | "starting" | "catching_up" | "covered";

export interface ScoreGap {
  rightId: string;
  /** Annualised value in minor units; 0 when the right is real but unquantified. */
  valueMinor: number;
  /** True when we cannot honestly put a number on it. */
  unquantified: boolean;
}

export interface EntitlementScoreResult {
  /** 0–1000. Familiar shape, deliberately: people already know how to read it. */
  score: number;
  band: ScoreBand;
  /** Annualised value of entitlements already acted on. */
  capturedMinor: number;
  /** Annualised value still sitting unclaimed. The headline. */
  unclaimedMinor: number;
  /** Money actually documented back, which is a much stronger claim than "captured". */
  recoveredMinor: number;
  /** Eligible rights count, and how many have been acted on. */
  eligibleCount: number;
  actedOnCount: number;
  /** How many eligible rights we cannot put a number on. Surfaced, not hidden. */
  unquantifiedCount: number;
  /** What to do next, most valuable first. Unquantified rights come last. */
  gaps: ScoreGap[];
  /** Component contributions, so the number is explainable rather than magic. */
  components: { key: "coverage" | "recovery" | "profile"; points: number; max: number }[];
}

/**
 * Annualised value of a right. A one-off is counted at its face value in the
 * year it is claimed rather than amortised: the person either gets that money
 * or does not, and spreading it over an invented horizon makes the figure less
 * true, not more conservative.
 */
function annualValue(right: ScorableRight): number {
  return Math.max(0, right.yearlyMinor ?? 0) + Math.max(0, right.oneTimeMinor ?? 0);
}

const MAX_COVERAGE = 600;
const MAX_RECOVERY = 300;
const MAX_PROFILE = 100;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function computeEntitlementScore(
  input: EntitlementScoreInput,
): EntitlementScoreResult {
  const acted = new Set(input.actedOn);
  const eligible = input.eligible;

  let capturedMinor = 0;
  let unclaimedMinor = 0;
  let unquantifiedCount = 0;
  const gaps: ScoreGap[] = [];

  for (const right of eligible) {
    const value = annualValue(right);
    const unquantified = value === 0;
    if (unquantified) unquantifiedCount++;

    if (acted.has(right.id)) {
      capturedMinor += value;
    } else {
      unclaimedMinor += value;
      gaps.push({ rightId: right.id, valueMinor: value, unquantified });
    }
  }

  // Most valuable first; unquantified rights are real but cannot be ranked by
  // money, so they sort last rather than being dropped or given a fake figure.
  gaps.sort((a, b) => {
    if (a.unquantified !== b.unquantified) return a.unquantified ? 1 : -1;
    if (b.valueMinor !== a.valueMinor) return b.valueMinor - a.valueMinor;
    return a.rightId.localeCompare(b.rightId);
  });

  /**
   * Coverage is measured by money where money is known, and falls back to a
   * simple count when nothing in the eligible set is quantified. Weighting by
   * value matters: claiming three ₪50 rights and skipping a ₪4,000 one is not
   * 75% covered, and a count-based score would say it was.
   */
  const totalValue = capturedMinor + unclaimedMinor;
  const coverageRatio =
    totalValue > 0
      ? capturedMinor / totalValue
      : eligible.length > 0
        ? acted.size / eligible.length
        : 0;

  /**
   * Recovery is capped against captured value rather than being open-ended:
   * the question it answers is "did the claims you filed actually pay out",
   * and without a denominator a single large windfall would max the component
   * for someone who is still leaking everywhere else.
   */
  const recoveryRatio = capturedMinor > 0 ? clamp01(input.recoveredMinor / capturedMinor) : 0;

  const components = [
    { key: "coverage" as const, points: Math.round(clamp01(coverageRatio) * MAX_COVERAGE), max: MAX_COVERAGE },
    { key: "recovery" as const, points: Math.round(recoveryRatio * MAX_RECOVERY), max: MAX_RECOVERY },
    {
      key: "profile" as const,
      points: Math.round(clamp01(input.profileCompleteness) * MAX_PROFILE),
      max: MAX_PROFILE,
    },
  ];

  const score = components.reduce((sum, c) => sum + c.points, 0);

  return {
    score,
    band: bandFor(score),
    capturedMinor,
    unclaimedMinor,
    recoveredMinor: Math.max(0, input.recoveredMinor),
    eligibleCount: eligible.length,
    actedOnCount: eligible.filter((r) => acted.has(r.id)).length,
    unquantifiedCount,
    gaps,
    components,
  };
}

/**
 * Bands are named for the person's situation, not graded like schoolwork.
 * "Leaking" describes what is happening to their money; "F" would describe
 * them, and being told you are an F for not having navigated a bureaucracy
 * designed to be un-navigable is both untrue and the reason people stop
 * opening an app.
 */
export function bandFor(score: number): ScoreBand {
  if (score >= 800) return "covered";
  if (score >= 500) return "catching_up";
  if (score >= 200) return "starting";
  return "leaking";
}

/**
 * The single most valuable thing to do next. Returned separately because the
 * whole product should be answerable in one line — the free tier shows this and
 * nothing else, which is both an honest free product and the clearest possible
 * argument for the paid one.
 */
export function nextBestAction(result: EntitlementScoreResult): ScoreGap | null {
  return result.gaps[0] ?? null;
}
