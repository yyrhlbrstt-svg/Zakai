/**
 * Client-side reminder hints for SENT cases (no push server required for v1).
 * Stores next-check timestamps in localStorage so solo ops need no workers.
 */

const KEY = "zakai_case_reminders_v1";

export interface CaseReminder {
  caseId: string;
  remindAt: number; // epoch ms
  providerLabel?: string;
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
  const all = loadReminders().filter((x) => x.caseId !== r.caseId);
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

/** Default: remind in 5 business-ish days (approx 7 calendar days). */
export function scheduleFollowUpReminder(caseId: string, providerLabel?: string): void {
  upsertReminder({
    caseId,
    providerLabel,
    remindAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
}
