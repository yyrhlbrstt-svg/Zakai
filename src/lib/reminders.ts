/**
 * Client-side reminder hints (no push server required for v1).
 * - Follow-up: SENT cases waiting on provider (~7 days)
 * - Recheck: SAVED cases whose promo window likely expired (~180 days)
 * Stores timestamps in localStorage so solo ops need no workers.
 */

const KEY = "zakai_case_reminders_v1";

export type ReminderKind = "followup" | "recheck";

export interface CaseReminder {
  caseId: string;
  remindAt: number; // epoch ms
  providerLabel?: string;
  kind?: ReminderKind;
}

export function loadReminders(): CaseReminder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CaseReminder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertReminder(r: CaseReminder): void {
  if (typeof window === "undefined") return;
  const all = loadReminders().filter((x) => !(x.caseId === r.caseId && (x.kind ?? "followup") === (r.kind ?? "followup")));
  all.push(r);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

export function dueReminders(now = Date.now()): CaseReminder[] {
  return loadReminders().filter((r) => r.remindAt <= now);
}

export function dueFollowUps(now = Date.now()): CaseReminder[] {
  return dueReminders(now).filter((r) => (r.kind ?? "followup") === "followup");
}

export function dueRechecks(now = Date.now()): CaseReminder[] {
  return dueReminders(now).filter((r) => r.kind === "recheck");
}

/** Default: remind in ~7 calendar days for provider follow-up. */
export function scheduleFollowUpReminder(caseId: string, providerLabel?: string): void {
  upsertReminder({
    caseId,
    providerLabel,
    kind: "followup",
    remindAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
}

/** After a documented saving — schedule re-check when promos typically expire (~180d). */
export function scheduleRecheckReminder(caseId: string, providerLabel?: string, days = 180): void {
  upsertReminder({
    caseId,
    providerLabel,
    kind: "recheck",
    remindAt: Date.now() + days * 24 * 60 * 60 * 1000,
  });
}
