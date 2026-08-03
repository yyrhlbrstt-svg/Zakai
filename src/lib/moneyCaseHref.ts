/**
 * Finish-surface deep link after vertical / scan open.
 * `sent=1` only when mail actually left (delivered) — never on QUEUED / fail-open.
 */
export function moneyCaseHref(
  caseId: string,
  opts?: { delivered?: boolean | null },
): string {
  if (opts?.delivered) return `/money?case=${caseId}&sent=1`;
  return `/money?case=${caseId}`;
}
