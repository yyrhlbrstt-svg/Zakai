import { PLAN_IDS, type PlanId } from "@/lib/plans";

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
