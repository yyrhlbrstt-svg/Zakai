/**
 * The coupon vault's rules, with no database and no React in them.
 *
 * Everything here is a pure function over plain rows, so the parts that decide
 * money, expiry and access can be tested directly rather than through a page.
 */

export const COUPON_CATEGORIES = [
  "shopping",
  "food",
  "software",
  "travel",
  "telecom",
  "home",
  "health",
  "other",
] as const;

export type CouponCategory = (typeof COUPON_CATEGORIES)[number];

export function isCouponCategory(v: string): v is CouponCategory {
  return (COUPON_CATEGORIES as readonly string[]).includes(v);
}

/** Days before expiry at which a coupon starts being called "closing soon". */
export const EXPIRING_SOON_DAYS = 14;

/** Whole percent, so 1..100 and nothing between. */
export const MAX_PERCENT_OFF = 100;

export interface CouponRow {
  id: string;
  merchant: string;
  code: string;
  category: string;
  percentOff: number | null;
  amountMinor: number | null;
  currency: string;
  minSpendMinor: number | null;
  expiresAt: Date | null;
  note: string;
  url: string;
  source: string;
  usedAt: Date | null;
  createdAt: Date;
}

/**
 * Four states, not two.
 *
 * "no expiry stated" is its own answer: it is not a promise that the coupon
 * lasts forever, and showing it as an open-ended green row would be inventing
 * a term the person never told us. It sorts after dated coupons for the same
 * reason — a date we know beats a date we don't.
 */
export type CouponStatus = "used" | "expired" | "expiring" | "active" | "undated";

export function couponStatus(row: CouponRow, now: Date = new Date()): CouponStatus {
  if (row.usedAt) return "used";
  if (!row.expiresAt) return "undated";
  const ms = row.expiresAt.getTime() - now.getTime();
  if (ms < 0) return "expired";
  return ms <= EXPIRING_SOON_DAYS * 86_400_000 ? "expiring" : "active";
}

/** Whole days until expiry; negative when past, null when no date was given. */
export function daysUntilExpiry(row: CouponRow, now: Date = new Date()): number | null {
  if (!row.expiresAt) return null;
  return Math.ceil((row.expiresAt.getTime() - now.getTime()) / 86_400_000);
}

const STATUS_ORDER: Record<CouponStatus, number> = {
  expiring: 0,
  active: 1,
  undated: 2,
  expired: 3,
  used: 4,
};

/**
 * Soonest-to-lose first.
 *
 * The entire reason to keep a vault is to not lose a discount to a date, so
 * the coupon about to expire outranks the bigger one that expires in a year.
 * Used and expired rows stay in the list rather than being deleted — a vault
 * that silently drops what lapsed cannot answer "did I ever use that", and
 * deleting a person's own record on their behalf is not ours to do.
 */
export function sortCoupons(rows: CouponRow[], now: Date = new Date()): CouponRow[] {
  return [...rows].sort((a, b) => {
    const sa = STATUS_ORDER[couponStatus(a, now)];
    const sb = STATUS_ORDER[couponStatus(b, now)];
    if (sa !== sb) return sa - sb;
    const ea = a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const eb = b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (ea !== eb) return ea - eb;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Substring match over the fields a person would actually type.
 *
 * The code itself is searchable — someone pasting a code to check whether they
 * already saved it is a real thing people do — but nothing here is ever sent
 * anywhere; this runs against rows already scoped to the one account.
 */
export function searchCoupons(rows: CouponRow[], query: string): CouponRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    [r.merchant, r.code, r.note, r.category].some((f) => f.toLowerCase().includes(q)),
  );
}

export function filterByCategory(rows: CouponRow[], category: string | null): CouponRow[] {
  if (!category || category === "all") return rows;
  return rows.filter((r) => r.category === category);
}

export interface CouponInput {
  merchant: string;
  code: string;
  category: string;
  percentOff: number | null;
  amountMinor: number | null;
  minSpendMinor: number | null;
  expiresAt: Date | null;
}

export type CouponValidation =
  | { ok: true; value: CouponInput }
  | { ok: false; reason: "merchant" | "code" | "category" | "value" | "percent" | "amount" };

/**
 * What a coupon must be before it is stored.
 *
 * The one rule worth naming: a coupon carries a percentage or a fixed sum,
 * never both. A row with both set has no single meaning, and a screen that
 * renders it has to pick one and be wrong half the time — so it is rejected at
 * the boundary instead of being resolved by a guess further in.
 */
export function validateCoupon(raw: {
  merchant?: unknown;
  code?: unknown;
  category?: unknown;
  percentOff?: unknown;
  amountMinor?: unknown;
  minSpendMinor?: unknown;
  expiresAt?: unknown;
}): CouponValidation {
  const merchant = typeof raw.merchant === "string" ? raw.merchant.trim() : "";
  if (!merchant || merchant.length > 80) return { ok: false, reason: "merchant" };

  const code = typeof raw.code === "string" ? raw.code.trim() : "";
  if (!code || code.length > 64) return { ok: false, reason: "code" };

  const category = typeof raw.category === "string" ? raw.category : "other";
  if (!isCouponCategory(category)) return { ok: false, reason: "category" };

  const percentOff =
    raw.percentOff === null || raw.percentOff === undefined || raw.percentOff === ""
      ? null
      : Number(raw.percentOff);
  const amountMinor =
    raw.amountMinor === null || raw.amountMinor === undefined || raw.amountMinor === ""
      ? null
      : Number(raw.amountMinor);

  if (percentOff !== null && amountMinor !== null) return { ok: false, reason: "value" };

  if (percentOff !== null) {
    if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > MAX_PERCENT_OFF) {
      return { ok: false, reason: "percent" };
    }
  }
  if (amountMinor !== null) {
    // Minor units, integer, always — a fee or a discount held as a float is
    // how a rounding error becomes a wrong number on somebody's receipt.
    if (!Number.isInteger(amountMinor) || amountMinor < 1 || amountMinor > 100_000_000) {
      return { ok: false, reason: "amount" };
    }
  }

  const minSpendRaw =
    raw.minSpendMinor === null || raw.minSpendMinor === undefined || raw.minSpendMinor === ""
      ? null
      : Number(raw.minSpendMinor);
  const minSpendMinor =
    minSpendRaw !== null && Number.isInteger(minSpendRaw) && minSpendRaw > 0 ? minSpendRaw : null;

  let expiresAt: Date | null = null;
  if (typeof raw.expiresAt === "string" && raw.expiresAt.trim()) {
    const d = new Date(raw.expiresAt);
    // An unparseable date becomes "no date given", never today, and never a
    // silently accepted Invalid Date that renders as NaN on the card.
    expiresAt = Number.isNaN(d.getTime()) ? null : d;
  } else if (raw.expiresAt instanceof Date && !Number.isNaN(raw.expiresAt.getTime())) {
    expiresAt = raw.expiresAt;
  }

  return {
    ok: true,
    value: { merchant, code, category, percentOff, amountMinor, minSpendMinor, expiresAt },
  };
}

/**
 * Which plans get the vault.
 *
 * The founder scoped this to Max and Pro. Business is included because a
 * paying business account being locked out of a feature a cheaper consumer
 * plan has is a billing bug wearing a gate's clothes.
 */
export const COUPON_VAULT_PLANS = ["PRO", "MAX", "BUSINESS"] as const;

export function planHasCouponVault(plan: string | null | undefined): boolean {
  return (COUPON_VAULT_PLANS as readonly string[]).includes(plan ?? "");
}

/** Coupons a reminder should go out about, soonest first. */
export function expiringSoon(rows: CouponRow[], now: Date = new Date()): CouponRow[] {
  return sortCoupons(
    rows.filter((r) => couponStatus(r, now) === "expiring"),
    now,
  );
}
