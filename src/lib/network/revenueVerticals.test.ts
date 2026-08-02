import { describe, expect, it } from "vitest";
import { REVENUE_VERTICALS, revenueVerticalsForMarket } from "./revenueVerticals";

describe("revenueVerticals", () => {
  it("includes live IL agent loops", () => {
    const il = revenueVerticalsForMarket("IL");
    expect(il.some((v) => v.id === "il_telecom_agent" && v.route === "/money")).toBe(true);
  });

  it("includes IL bank loan opening fee letter pack", () => {
    const il = revenueVerticalsForMarket("IL");
    const loan = il.find((v) => v.id === "il_bank_loan_opening_fee");
    expect(loan?.route).toBe("/bank-loan-fee");
    expect(loan?.packRightId).toBe("bank_loan_opening_commission_il");
    expect(loan?.status).toBe("letter_pack");
  });

  it("includes GB student loan vertical with pack right", () => {
    const gb = revenueVerticalsForMarket("GB");
    const sl = gb.find((v) => v.id === "gb_student_loan_overpayment");
    expect(sl?.packRightId).toBe("student_loan_overpayment");
    expect(sl?.avgRecoveryMinor).toBe(24_000);
  });

  it("includes US wage vertical with route", () => {
    const us = revenueVerticalsForMarket("US");
    const wage = us.find((v) => v.id === "us_wage_theft");
    expect(wage?.route).toBe("/wage-statement-audit");
    expect(wage?.packRightId).toBe("wage_statement_audit");
  });

  it("network rows appear for every market via wildcard", () => {
    expect(revenueVerticalsForMarket("IL").some((v) => v.monetization === "oracle_api")).toBe(true);
    expect(REVENUE_VERTICALS.length).toBeGreaterThanOrEqual(8);
  });
});
