import { PLAN_IDS, type PlanId } from "@/lib/plans";
import { FOLLOWUP_AFTER_DAYS_MIN } from "@/lib/strategy/learningInsights";

/**
 * Backs the pricing page's "עדיפות בטיפול בתיקים" (priority case handling)
 * promise on Pro/Max/Business: when a cron run has more due cases than it
 * can process in one pass, paid tiers go first. Never changes *when* a case
 * becomes eligible for follow-up (that stays on the cohort-learned wait
 * time) — only the order eligible cases are processed in.
 */
export function planPriority(plan: string | null | undefined): number {
  const idx = PLAN_IDS.indexOf((plan ?? "FREE") as PlanId);
  return idx === -1 ? 0 : idx;
}

export function sortByFollowUpPriority<T extends { plan: string | null | undefined; updatedAt: Date }>(
  cases: T[],
): T[] {
  return [...cases].sort((a, b) => {
    const byPlan = planPriority(b.plan) - planPriority(a.plan);
    return byPlan !== 0 ? byPlan : a.updatedAt.getTime() - b.updatedAt.getTime();
  });
}

/**
 * Distinct from planPriority above: this changes *when* a case becomes
 * eligible, not just the order eligible cases are processed in. Paid plans
 * chase a provider sooner than the cohort-learned wait would otherwise say —
 * a real behavioral difference, not a decoration. FREE stays exactly on the
 * learned/default timing (multiplier 1); the floor (FOLLOWUP_AFTER_DAYS_MIN)
 * still applies so a paid plan never gets day-0 theater either.
 */
const PLAN_FOLLOWUP_SPEED_MULTIPLIER: Record<PlanId, number> = {
  FREE: 1,
  PRO: 0.8,
  MAX: 0.6,
  BUSINESS: 0.6,
};

export function planFollowUpWaitDays(baseWaitDays: number, plan: string | null | undefined): number {
  const normalized = plan ?? "FREE";
  const id = PLAN_IDS.includes(normalized as PlanId) ? (normalized as PlanId) : "FREE";
  const scaled = Math.round(baseWaitDays * PLAN_FOLLOWUP_SPEED_MULTIPLIER[id]);
  return Math.max(FOLLOWUP_AFTER_DAYS_MIN, scaled);
}
