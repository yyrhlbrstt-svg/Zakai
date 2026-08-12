import { describe, expect, it } from "vitest";
import {
  couponStatus,
  daysUntilExpiry,
  expiringSoon,
  filterByCategory,
  planHasCouponVault,
  searchCoupons,
  sortCoupons,
  validateCoupon,
  type CouponRow,
} from "./coupons";

const NOW = new Date("2026-06-01T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

function row(over: Partial<CouponRow> = {}): CouponRow {
  return {
    id: "x",
    merchant: "Shufersal",
    code: "SAVE20",
    category: "food",
    percentOff: 20,
    amountMinor: null,
    currency: "ILS",
    minSpendMinor: null,
    expiresAt: days(60),
    note: "",
    url: "",
    source: "manual",
    usedAt: null,
    createdAt: NOW,
    ...over,
  };
}

describe("couponStatus — four states, because three of them are not 'fine'", () => {
  it("separates 'no expiry stated' from 'never expires' and from expired", () => {
    expect(couponStatus(row({ expiresAt: null }), NOW)).toBe("undated");
    expect(couponStatus(row({ expiresAt: days(-1) }), NOW)).toBe("expired");
    expect(couponStatus(row({ expiresAt: days(60) }), NOW)).toBe("active");
  });

  it("calls a coupon expiring only inside the notice window", () => {
    expect(couponStatus(row({ expiresAt: days(13) }), NOW)).toBe("expiring");
    expect(couponStatus(row({ expiresAt: days(15) }), NOW)).toBe("active");
  });

  it("a used coupon is used, whatever its date says", () => {
    expect(couponStatus(row({ usedAt: NOW, expiresAt: days(90) }), NOW)).toBe("used");
    expect(couponStatus(row({ usedAt: NOW, expiresAt: days(-90) }), NOW)).toBe("used");
  });

  it("reports days left, negative when past, null when undated", () => {
    expect(daysUntilExpiry(row({ expiresAt: days(7) }), NOW)).toBe(7);
    expect(daysUntilExpiry(row({ expiresAt: days(-3) }), NOW)).toBe(-3);
    expect(daysUntilExpiry(row({ expiresAt: null }), NOW)).toBeNull();
  });
});

describe("sortCoupons — soonest to lose, first", () => {
  it("puts the coupon about to expire above the bigger one that is not", () => {
    const soon = row({ id: "soon", percentOff: 5, expiresAt: days(3) });
    const big = row({ id: "big", percentOff: 50, expiresAt: days(200) });
    expect(sortCoupons([big, soon], NOW).map((r) => r.id)).toEqual(["soon", "big"]);
  });

  it("keeps expired and used rows in the list, at the bottom", () => {
    const gone = row({ id: "gone", expiresAt: days(-5) });
    const used = row({ id: "used", usedAt: NOW });
    const live = row({ id: "live", expiresAt: days(30) });
    const order = sortCoupons([used, gone, live], NOW).map((r) => r.id);
    expect(order).toEqual(["live", "gone", "used"]);
    expect(order).toHaveLength(3);
  });

  it("dated coupons outrank undated ones", () => {
    const undated = row({ id: "undated", expiresAt: null });
    const dated = row({ id: "dated", expiresAt: days(300) });
    expect(sortCoupons([undated, dated], NOW).map((r) => r.id)).toEqual(["dated", "undated"]);
  });
});

describe("search and filter", () => {
  const rows = [
    row({ id: "a", merchant: "Shufersal", code: "FOOD10", category: "food", note: "" }),
    row({ id: "b", merchant: "Adobe", code: "CREATE50", category: "software", note: "שנתי" }),
  ];

  it("matches merchant, code, note and category", () => {
    expect(searchCoupons(rows, "adobe").map((r) => r.id)).toEqual(["b"]);
    expect(searchCoupons(rows, "food10").map((r) => r.id)).toEqual(["a"]);
    expect(searchCoupons(rows, "שנתי").map((r) => r.id)).toEqual(["b"]);
    expect(searchCoupons(rows, "software").map((r) => r.id)).toEqual(["b"]);
  });

  it("an empty query returns everything rather than nothing", () => {
    expect(searchCoupons(rows, "   ")).toHaveLength(2);
  });

  it("filters by category, and 'all' means all", () => {
    expect(filterByCategory(rows, "food").map((r) => r.id)).toEqual(["a"]);
    expect(filterByCategory(rows, "all")).toHaveLength(2);
    expect(filterByCategory(rows, null)).toHaveLength(2);
  });
});

describe("validateCoupon — the boundary that keeps bad rows out", () => {
  it("rejects a coupon that is both a percentage and a fixed sum", () => {
    const r = validateCoupon({ merchant: "X", code: "C", category: "other", percentOff: 10, amountMinor: 500 });
    expect(r).toEqual({ ok: false, reason: "value" });
  });

  it("accepts either one alone, and neither", () => {
    expect(validateCoupon({ merchant: "X", code: "C", category: "other", percentOff: 10 }).ok).toBe(true);
    expect(validateCoupon({ merchant: "X", code: "C", category: "other", amountMinor: 500 }).ok).toBe(true);
    expect(validateCoupon({ merchant: "X", code: "C", category: "other" }).ok).toBe(true);
  });

  it("refuses a fractional or out-of-range amount — minor units, integers, always", () => {
    expect(validateCoupon({ merchant: "X", code: "C", category: "other", amountMinor: 12.5 })).toEqual({
      ok: false,
      reason: "amount",
    });
    expect(validateCoupon({ merchant: "X", code: "C", category: "other", amountMinor: 0 })).toEqual({
      ok: false,
      reason: "amount",
    });
  });

  it("refuses a percentage outside 1..100 or with a fraction", () => {
    for (const p of [0, 101, 12.5, -5]) {
      expect(validateCoupon({ merchant: "X", code: "C", category: "other", percentOff: p }).ok).toBe(false);
    }
  });

  it("refuses an unknown category rather than silently filing it under 'other'", () => {
    expect(validateCoupon({ merchant: "X", code: "C", category: "crypto" })).toEqual({
      ok: false,
      reason: "category",
    });
  });

  it("requires a merchant and a code", () => {
    expect(validateCoupon({ merchant: "  ", code: "C", category: "other" })).toEqual({
      ok: false,
      reason: "merchant",
    });
    expect(validateCoupon({ merchant: "X", code: "", category: "other" })).toEqual({
      ok: false,
      reason: "code",
    });
  });

  it("turns an unparseable date into 'no date given', never today and never NaN", () => {
    const r = validateCoupon({ merchant: "X", code: "C", category: "other", expiresAt: "not-a-date" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.expiresAt).toBeNull();
  });

  it("trims but does not otherwise rewrite the code", () => {
    const r = validateCoupon({ merchant: " Adobe ", code: "  save-50 ", category: "other" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.merchant).toBe("Adobe");
      expect(r.value.code).toBe("save-50");
    }
  });
});

describe("plan gate", () => {
  it("opens for the paid plans and closes for free", () => {
    expect(planHasCouponVault("PRO")).toBe(true);
    expect(planHasCouponVault("MAX")).toBe(true);
    expect(planHasCouponVault("BUSINESS")).toBe(true);
    expect(planHasCouponVault("FREE")).toBe(false);
    expect(planHasCouponVault(null)).toBe(false);
    expect(planHasCouponVault(undefined)).toBe(false);
    expect(planHasCouponVault("")).toBe(false);
  });
});

describe("expiringSoon — what a reminder should be about", () => {
  it("returns only the notice window, soonest first", () => {
    const rows = [
      row({ id: "far", expiresAt: days(90) }),
      row({ id: "b", expiresAt: days(10) }),
      row({ id: "a", expiresAt: days(2) }),
      row({ id: "gone", expiresAt: days(-1) }),
      row({ id: "used", expiresAt: days(3), usedAt: NOW }),
    ];
    expect(expiringSoon(rows, NOW).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("says nothing when nothing is closing", () => {
    expect(expiringSoon([row({ expiresAt: days(90) })], NOW)).toEqual([]);
  });
});
