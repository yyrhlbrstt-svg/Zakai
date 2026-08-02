import { describe, expect, it } from "vitest";
import { REVENUE_VERTICALS, revenueVerticalsForMarket } from "./revenueVerticals";

describe("revenueVerticals", () => {
  it("includes live IL agent loops", () => {
    const il = revenueVerticalsForMarket("IL");
    expect(il.some((v) => v.id === "il_telecom_agent" && v.route === "/money")).toBe(true);
  });

  it("includes GB student loan vertical with pack right", () => {
    const gb = revenueVerticalsForMarket("GB");
    const sl = gb.find((v) => v.id === "gb_student_loan_overpayment");
    expect(sl?.packRightId).toBe("student_loan_overpayment");
    expect(sl?.avgRecoveryMinor).toBe(24_000);
  });

  it("network rows appear for every market via wildcard", () => {
    expect(revenueVerticalsForMarket("IL").some((v) => v.monetization === "oracle_api")).toBe(true);
    expect(REVENUE_VERTICALS.length).toBeGreaterThanOrEqual(8);
  });
});
