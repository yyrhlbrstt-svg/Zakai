import { describe, expect, it } from "vitest";
import {
  actionRouteForEntitlement,
  FULL_SERVICE_ENTITLEMENT_IDS,
  isFullServiceEntitlement,
} from "./entitlementRoutes";

describe("actionRouteForEntitlement", () => {
  it("routes monetizable consumer verticals to agent loops", () => {
    expect(actionRouteForEntitlement("electricity_switch")).toBe("/electricity");
    expect(actionRouteForEntitlement("consumer_cancel14")).toBe("/consumer-cancel");
    expect(actionRouteForEntitlement("duplicate_charge_dispute")).toBe("/refund-chase");
  });

  it("routes benefits to dedicated pages", () => {
    expect(actionRouteForEntitlement("maternity_grant")).toBe("/maternity");
    expect(actionRouteForEntitlement("miluim_pay")).toBe("/miluim");
  });

  it("falls international ids to /rights unless a vertical ships", () => {
    expect(actionRouteForEntitlement("us_eitc")).toBe("/rights");
    expect(actionRouteForEntitlement("uk_student_loan_overpayment")).toBe(
      "/student-loan-overpayment",
    );
    expect(actionRouteForEntitlement("us_wage_statement_audit")).toBe("/wage-statement-audit");
    expect(actionRouteForEntitlement("train_delay_compensation")).toBe("/train-delay");
    expect(actionRouteForEntitlement("collection_agency_complaint_il")).toBe("/collection-complaint");
    expect(actionRouteForEntitlement("route6_dispute")).toBe("/toll-dispute");
  });

  it("flags full-service ids", () => {
    for (const id of FULL_SERVICE_ENTITLEMENT_IDS) {
      expect(isFullServiceEntitlement(id)).toBe(true);
    }
    expect(isFullServiceEntitlement("tax_refund")).toBe(false);
  });
});
