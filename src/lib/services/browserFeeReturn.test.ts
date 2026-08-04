import { describe, expect, it } from "vitest";
import { browserFeeReturnWhenUnverified, withReturnQuery } from "./browserFeeReturn";

describe("browserFeeReturnWhenUnverified", () => {
  it("treats already-PAID fee as paid (webhook won the race)", () => {
    expect(
      browserFeeReturnWhenUnverified({ feeStatus: "PAID", outcomeHint: "failure" }),
    ).toBe("paid");
  });

  it("shows confirming after success bounce while fee still PENDING", () => {
    expect(
      browserFeeReturnWhenUnverified({ feeStatus: "PENDING", outcomeHint: "success" }),
    ).toBe("confirming");
  });

  it("sends failure / cancel / bare GET to error checkout", () => {
    expect(
      browserFeeReturnWhenUnverified({ feeStatus: "PENDING", outcomeHint: "failure" }),
    ).toBe("error");
    expect(
      browserFeeReturnWhenUnverified({ feeStatus: "PENDING", outcomeHint: "cancel" }),
    ).toBe("error");
    expect(browserFeeReturnWhenUnverified({ feeStatus: "PENDING" })).toBe("error");
  });
});

describe("withReturnQuery", () => {
  it("preserves feeId and adds outcome", () => {
    const out = withReturnQuery(
      "https://zakai.example/api/payments/callback?loc=he&feeId=fee_1",
      { outcome: "success" },
    );
    const url = new URL(out);
    expect(url.searchParams.get("feeId")).toBe("fee_1");
    expect(url.searchParams.get("loc")).toBe("he");
    expect(url.searchParams.get("outcome")).toBe("success");
  });
});
