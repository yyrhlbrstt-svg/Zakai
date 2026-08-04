/** Validate and normalize a counterparty inbox for outbound case email. */

export function normalizeOutreachEmail(value: string | undefined | null): string | null {
  const e = value?.trim();
  if (!e || !/@/.test(e)) return null;
  return e.toLowerCase();
}

/**
 * IETF reserved example hosts must never leave the Outbox — they look like
 * "we sent" while delivering nowhere.
 */
export function isPlaceholderOutreachHost(email: string): boolean {
  const host = email.split("@")[1] || "";
  return (
    host === "example.com" ||
    host === "example.org" ||
    host === "example.net" ||
    host.endsWith(".example")
  );
}

/** Normalize + reject placeholder hosts. */
export function usableOutreachEmail(value: string | undefined | null): string | null {
  const n = normalizeOutreachEmail(value);
  if (!n || isPlaceholderOutreachHost(n)) return null;
  return n;
}

export function firstOutreachEmail(...candidates: (string | undefined | null)[]): string | null {
  for (const c of candidates) {
    const n = usableOutreachEmail(c);
    if (n) return n;
  }
  return null;
}

export function isOutreachEmailApiError(error: unknown): boolean {
  return error === "NEEDS_OUTREACH_EMAIL" || error === "needsOutreachEmail";
}
