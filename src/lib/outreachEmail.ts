/** Validate and normalize a counterparty inbox for outbound case email. */

export function normalizeOutreachEmail(value: string | undefined | null): string | null {
  const e = value?.trim();
  if (!e || !/@/.test(e)) return null;
  return e.toLowerCase();
}

export function firstOutreachEmail(...candidates: (string | undefined | null)[]): string | null {
  for (const c of candidates) {
    const n = normalizeOutreachEmail(c);
    if (n) return n;
  }
  return null;
}
