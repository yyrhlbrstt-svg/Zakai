import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindUnique = vi.fn();
const couponCount = vi.fn();
const couponCreate = vi.fn();
const couponUpdateMany = vi.fn();
const couponDeleteMany = vi.fn();
const couponFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    coupon: {
      count: (...a: unknown[]) => couponCount(...a),
      create: (...a: unknown[]) => couponCreate(...a),
      updateMany: (...a: unknown[]) => couponUpdateMany(...a),
      deleteMany: (...a: unknown[]) => couponDeleteMany(...a),
      findMany: (...a: unknown[]) => couponFindMany(...a),
    },
  },
}));

const { addCoupon, deleteCoupon, setCouponUsed, CouponError } = await import("./couponVault");

const VALID = { merchant: "Adobe", code: "SAVE50", category: "software" as const };

beforeEach(() => {
  for (const m of [userFindUnique, couponCount, couponCreate, couponUpdateMany, couponDeleteMany, couponFindMany]) {
    m.mockReset();
  }
  userFindUnique.mockResolvedValue({ plan: "PRO" });
  couponCount.mockResolvedValue(0);
  couponCreate.mockResolvedValue({ id: "c1" });
  couponUpdateMany.mockResolvedValue({ count: 1 });
  couponDeleteMany.mockResolvedValue({ count: 1 });
});

describe("the plan gate is enforced in the write path, not only on the screen", () => {
  it("refuses a free account even with a perfectly valid coupon", async () => {
    userFindUnique.mockResolvedValue({ plan: "FREE" });
    await expect(addCoupon("u1", VALID)).rejects.toThrow(CouponError);
    expect(couponCreate).not.toHaveBeenCalled();
  });

  it("reads the plan from the database, never from the caller", async () => {
    await addCoupon("u1", VALID);
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { plan: true },
    });
  });

  it("lets a paid account through", async () => {
    for (const plan of ["PRO", "MAX", "BUSINESS"]) {
      couponCreate.mockClear();
      userFindUnique.mockResolvedValue({ plan });
      await expect(addCoupon("u1", VALID)).resolves.toEqual({ id: "c1" });
      expect(couponCreate).toHaveBeenCalledOnce();
    }
  });
});

describe("what gets stored", () => {
  it("rejects an invalid coupon before touching the database", async () => {
    await expect(
      addCoupon("u1", { ...VALID, percentOff: 10, amountMinor: 500 }),
    ).rejects.toThrow(CouponError);
    expect(couponCreate).not.toHaveBeenCalled();
  });

  it("drops a javascript: url rather than storing a link that runs code", async () => {
    await addCoupon("u1", { ...VALID, url: "javascript:alert(1)" });
    expect(couponCreate.mock.calls[0][0].data.url).toBe("");
  });

  it("keeps an http(s) url", async () => {
    await addCoupon("u1", { ...VALID, url: "https://example.com/deal" });
    expect(couponCreate.mock.calls[0][0].data.url).toBe("https://example.com/deal");
  });

  it("marks every row as manually entered — nothing here was discovered for the user", async () => {
    await addCoupon("u1", VALID);
    expect(couponCreate.mock.calls[0][0].data.source).toBe("manual");
  });

  it("stops at the per-account cap", async () => {
    couponCount.mockResolvedValue(500);
    await expect(addCoupon("u1", VALID)).rejects.toThrow(CouponError);
    expect(couponCreate).not.toHaveBeenCalled();
  });
});

describe("ownership is part of the write, not a check before it", () => {
  it("scopes mark-used by userId in the same query", async () => {
    await setCouponUsed("u1", "c1", true);
    expect(couponUpdateMany.mock.calls[0][0].where).toEqual({ id: "c1", userId: "u1" });
  });

  it("scopes delete by userId in the same query", async () => {
    await deleteCoupon("u1", "c1");
    expect(couponDeleteMany.mock.calls[0][0].where).toEqual({ id: "c1", userId: "u1" });
  });

  it("treats another account's coupon as not found, never as a silent success", async () => {
    couponUpdateMany.mockResolvedValue({ count: 0 });
    couponDeleteMany.mockResolvedValue({ count: 0 });
    await expect(setCouponUsed("u1", "someone-elses", true)).rejects.toThrow(CouponError);
    await expect(deleteCoupon("u1", "someone-elses")).rejects.toThrow(CouponError);
  });

  it("marking unused clears the timestamp rather than setting a new one", async () => {
    await setCouponUsed("u1", "c1", false);
    expect(couponUpdateMany.mock.calls[0][0].data).toEqual({ usedAt: null });
  });
});
