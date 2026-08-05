/** Attempt accounting for Outbox FAILED retries — encoded in `error`, no schema migration. */

export const MAX_OUTBOX_ATTEMPTS = 5;
export const OUTBOX_DEAD_LETTER_PREFIX = "[dead-letter]";
const ATTEMPTS_RE = /^\[attempts=(\d+)\]\s*/;

export function parseOutboxAttempts(error: string | null | undefined): number {
  if (!error) return 0;
  if (error.startsWith(OUTBOX_DEAD_LETTER_PREFIX)) return MAX_OUTBOX_ATTEMPTS;
  const m = error.match(ATTEMPTS_RE);
  return m ? Number(m[1]) : 0;
}

export function formatOutboxFailure(attempts: number, detail: string): string {
  const n = Math.max(1, Math.min(MAX_OUTBOX_ATTEMPTS, attempts));
  const body = detail.replace(ATTEMPTS_RE, "").replace(/^\[dead-letter\]\s*/, "").slice(0, 1800);
  if (n >= MAX_OUTBOX_ATTEMPTS) {
    return `${OUTBOX_DEAD_LETTER_PREFIX} [attempts=${n}] ${body}`.slice(0, 1900);
  }
  return `[attempts=${n}] ${body}`.slice(0, 1900);
}

export function isOutboxDeadLetter(error: string | null | undefined): boolean {
  return Boolean(error?.startsWith(OUTBOX_DEAD_LETTER_PREFIX));
}
