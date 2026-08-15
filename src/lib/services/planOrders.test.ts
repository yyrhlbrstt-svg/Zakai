import { describe, expect, it } from "vitest";
import { PLAN_REF_PREFIX, planOrderIdFromRef } from "./planOrders";

/**
 * The reference namespace is load-bearing.
 *
 * One authenticated callback route now confirms two kinds of payment: a
 * success fee, and a plan purchase. They are told apart by a prefix on the
 * opaque reference the PSP echoes back. If that split is ever wrong in the
 * confusable direction — a fee id read as a plan order, or the reverse — the
 * failure is money: somebody's fee marked paid by a subscription callback, or
 * a plan granted by a fee's.
 *
 * These are the cases where a naive `includes("plan_")` or a mid-string match
 * would get it wrong.
 */
describe("plan payment references", () => {
  it("reads a plan order id back out", () => {
    expect(planOrderIdFromRef(`${PLAN_REF_PREFIX}abc123`)).toBe("abc123");
  });

  it("does not claim a fee id", () => {
    // cuid()s are what fee ids look like. None of these are plan orders.
    expect(planOrderIdFromRef("clx9f0planx0001")).toBeNull();
    expect(planOrderIdFromRef("cm2plan_notaprefix")).toBeNull();
    expect(planOrderIdFromRef("")).toBeNull();
  });

  it("only matches at the start, never mid-string", () => {
    // A fee id that merely contains the prefix must not be hijacked.
    expect(planOrderIdFromRef(`fee_${PLAN_REF_PREFIX}abc`)).toBeNull();
  });

  it("refuses a prefix with nothing after it", () => {
    // Otherwise this would resolve to an empty id and query for "any order".
    expect(planOrderIdFromRef(PLAN_REF_PREFIX)).toBeNull();
  });
});
