/**
 * HITL OvernightAgent must not appear on day-0 SENT — copy says "waited several
 * days" and cron uses the same wait. Shared gate for /money + dashboard.
 */
export function isOvernightFollowUpDue(opts: {
  updatedAt: Date | string | number;
  waitDays: number;
  nowMs?: number;
}): boolean {
  const updatedMs =
    opts.updatedAt instanceof Date
      ? opts.updatedAt.getTime()
      : new Date(opts.updatedAt).getTime();
  if (!Number.isFinite(updatedMs) || opts.waitDays < 0) return false;
  const now = opts.nowMs ?? Date.now();
  return updatedMs <= now - opts.waitDays * 86_400_000;
}
