/**
 * Money Health Score — "ציון הבריאות הפיננסית".
 *
 * The recurring-need engine: turns Zakai from a one-time tool into a habit.
 * A 0–100 score of how well the user is covering the money they're owed,
 * computed only from things we can actually measure (checks run, savings
 * documented, plan, referrals, recency). Everything not yet earned becomes a
 * concrete "mission" that raises the score — a reason to come back. Pure and
 * deterministic; tested.
 */

export interface MoneyScoreInput {
  /** Number of checks/cases the user has created. */
  casesCount: number;
  /** True once at least one saving is documented in the ledger. */
  hasDocumentedSaving: boolean;
  /** Days since the user's last activity (null = no activity yet). */
  daysSinceActivity: number | null;
  /** Plan id (FREE/PRO/MAX). */
  plan: string;
  /** True if the user has referred at least one friend. */
  hasReferred: boolean;
}

export type MoneyScoreLevel = "start" | "onTrack" | "good" | "excellent";

export interface ScoreComponent {
  key: "firstCheck" | "breadth" | "saving" | "fresh" | "plan" | "invite";
  points: number;
  earned: boolean;
  /** Screen that lets the user earn this component. */
  href: string;
}

export interface MoneyScoreResult {
  score: number; // 0–100
  level: MoneyScoreLevel;
  components: ScoreComponent[];
  /** Unearned components, highest-value first — the "missions". */
  missions: ScoreComponent[];
}

const FRESH_WINDOW_DAYS = 90;

export function computeMoneyScore(input: MoneyScoreInput): MoneyScoreResult {
  const plan = (input.plan || "FREE").toUpperCase();
  const fresh = input.daysSinceActivity !== null && input.daysSinceActivity <= FRESH_WINDOW_DAYS;

  const components: ScoreComponent[] = [
    { key: "firstCheck", points: 25, earned: input.casesCount >= 1, href: "/check" },
    { key: "breadth", points: 15, earned: input.casesCount >= 3, href: "/check" },
    { key: "saving", points: 30, earned: input.hasDocumentedSaving, href: "/dashboard" },
    { key: "fresh", points: 10, earned: fresh, href: "/check" },
    { key: "plan", points: 10, earned: plan === "PRO" || plan === "MAX", href: "/pricing" },
    { key: "invite", points: 10, earned: input.hasReferred, href: "/dashboard" },
  ];

  const score = components.reduce((s, c) => s + (c.earned ? c.points : 0), 0);
  const level: MoneyScoreLevel =
    score >= 90 ? "excellent" : score >= 60 ? "good" : score >= 30 ? "onTrack" : "start";

  const missions = components.filter((c) => !c.earned).sort((a, b) => b.points - a.points);

  return { score, level, components, missions };
}
