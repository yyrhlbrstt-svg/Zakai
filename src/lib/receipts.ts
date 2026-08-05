/**
 * Receipt collector — pure logic, no DB. Two jobs: decide whether a newly
 * scanned receipt looks like a duplicate charge worth a refund claim, and
 * format a user's receipts as CSV for their accountant.
 */

export type ReceiptCategory = "business_deductible" | "recurring" | "personal" | "other";

export interface ReceiptLike {
  id: string;
  vendor: string;
  amountAgorot: number;
  /** The date on the receipt if known, else when it was recorded. */
  occurredAt: Date;
}

/**
 * Same vendor read as "Cellcom Ltd", "CELLCOM", "סלקום בע״מ" should still
 * collide. Anchored on whitespace/start rather than \b — \b is defined by
 * ASCII \w, so it never fires around Hebrew letters or a preceding quote
 * character and would silently fail to strip בע"מ.
 */
const LEGAL_SUFFIX_RE = /(?:^|\s)(בע"מ|בעמ|ltd|llc|inc|co)\.?\s*$/i;

export function normalizeVendor(vendor: string): string {
  return vendor
    .trim()
    .toLowerCase()
    .replace(LEGAL_SUFFIX_RE, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * A second charge from the same vendor, for the same amount, within this many
 * days of the first, is what a real duplicate-charge looks like — a retry
 * after a declined card, a POS terminal double-swipe, a subscription billed
 * twice in one cycle. Wide enough to catch a billing-cycle-adjacent repeat,
 * narrow enough that two separate visits to the same coffee shop for the
 * same ₪18 don't get flagged as fraud.
 */
export const DUPLICATE_WINDOW_DAYS = 21;

/**
 * Returns the earlier receipt this candidate duplicates, or null. Pure:
 * takes only the fields the decision needs, so it's testable without a DB
 * and reusable regardless of where receipts come from (photo today; email
 * or WhatsApp are the same shape once those transports exist).
 */
export function findDuplicateReceipt(
  candidate: Pick<ReceiptLike, "vendor" | "amountAgorot" | "occurredAt">,
  existing: readonly ReceiptLike[],
): ReceiptLike | null {
  if (candidate.amountAgorot <= 0) return null;
  const vendor = normalizeVendor(candidate.vendor);
  if (!vendor) return null;
  const windowMs = DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  let closest: ReceiptLike | null = null;
  let closestDiff = Infinity;
  for (const r of existing) {
    if (r.amountAgorot !== candidate.amountAgorot) continue;
    if (normalizeVendor(r.vendor) !== vendor) continue;
    const diff = Math.abs(candidate.occurredAt.getTime() - r.occurredAt.getTime());
    if (diff > windowMs) continue;
    if (diff < closestDiff) {
      closest = r;
      closestDiff = diff;
    }
  }
  return closest;
}

export interface ReceiptExportRow {
  vendor: string;
  amountAgorot: number;
  currency: string;
  occurredAt: Date | null;
  category: ReceiptCategory | string;
  hasVat: boolean;
  flaggedAt: Date | null;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** UTF-8 CSV an accountant can open directly — one row per receipt, newest first. */
export function receiptsToCsv(rows: readonly ReceiptExportRow[]): string {
  const header = ["vendor", "amount", "currency", "date", "category", "vat", "flagged_duplicate"];
  const lines = rows.map((r) =>
    [
      csvCell(r.vendor),
      (r.amountAgorot / 100).toFixed(2),
      r.currency,
      r.occurredAt ? r.occurredAt.toISOString().slice(0, 10) : "",
      r.category,
      r.hasVat ? "yes" : "no",
      r.flaggedAt ? "yes" : "no",
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
