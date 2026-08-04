/**
 * Deterministic IL amount parse — SavingsProof path must not die when AI is down.
 * Never auto-records; caller still requires one-tap confirm.
 */

const SHEKEL_PATTERNS: RegExp[] = [
  /(?:₪|ש["׳']?\s*ח\.?|NIS|ILS)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi,
  /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:₪|ש["׳']?\s*ח\.?|NIS|ILS)/gi,
  /(?:סכום|יתרה|לתשלום|החיוב|התשלום|מחיר|הנחה ל)\s*[:=]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi,
];

function parseNum(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Best-effort shekel amount from provider reply text.
 * Prefers amounts near `originalShekels` when several candidates exist.
 */
export function extractShekelAmountFromText(
  text: string,
  opts?: { originalShekels?: number },
): { shekels: number; confidence: number } | null {
  const body = text.trim();
  if (body.length < 8) return null;

  const found = new Set<number>();
  for (const re of SHEKEL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const n = parseNum(m[1] ?? "");
      if (n != null) found.add(n);
    }
  }
  if (found.size === 0) return null;

  const candidates = [...found];
  const original = opts?.originalShekels;
  let pick = candidates[0]!;
  if (original != null && Number.isFinite(original)) {
    // Prefer a new amount at or below original (a saving), closest to original.
    const below = candidates.filter((c) => c <= original + 0.01);
    const pool = below.length > 0 ? below : candidates;
    pick = pool.reduce((best, c) =>
      Math.abs(c - original) < Math.abs(best - original) ? c : best,
    );
  }

  return {
    shekels: pick,
    confidence: found.size === 1 ? 0.72 : 0.55,
  };
}
