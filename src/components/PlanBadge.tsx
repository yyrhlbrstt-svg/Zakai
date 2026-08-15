/**
 * Premium plan badge. FREE renders nothing; PRO gets the emerald→cyan family;
 * MAX gets a champagne-gold treatment with a slow sheen; BUSINESS gets the
 * full brand gradient (every hue the mark itself uses) with the same sheen
 * plus a slow drift — the top of the ladder, not a variation on MAX. A quiet
 * "you're a member" signal that appears on every screen once signed in.
 * Compositor-only (transform/background-position), so it stays cheap even
 * animated.
 */
const PLAN_BADGE_CLASS: Record<string, string> = {
  PRO: "plan-badge-pro",
  MAX: "plan-badge-max",
  BUSINESS: "plan-badge-business",
};

export function PlanBadge({ plan, className = "" }: { plan?: string; className?: string }) {
  const p = (plan ?? "").toUpperCase();
  const badgeClass = PLAN_BADGE_CLASS[p];
  if (!badgeClass) return null;

  return (
    <span className={`plan-badge ${badgeClass} ${className}`} aria-label={p}>
      {p}
    </span>
  );
}
