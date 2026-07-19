/**
 * Premium plan badge. FREE renders nothing; PRO gets the emerald→cyan family;
 * MAX gets a champagne-gold treatment with a slow sheen — a quiet "you're a
 * member" signal that appears on every screen once signed in. Compositor-only.
 */
export function PlanBadge({ plan, className = "" }: { plan?: string; className?: string }) {
  const p = (plan ?? "").toUpperCase();
  if (p !== "PRO" && p !== "MAX") return null;

  const isMax = p === "MAX";
  return (
    <span
      className={`plan-badge ${isMax ? "plan-badge-max" : "plan-badge-pro"} ${className}`}
      aria-label={p}
    >
      {p}
    </span>
  );
}
