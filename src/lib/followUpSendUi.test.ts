import { describe, expect, it } from "vitest";
import { classifyFollowUpSendError, followUpDeliveryState } from "./followUpSendUi";

describe("classifyFollowUpSendError", () => {
  it("maps known CaseError codes", () => {
    expect(classifyFollowUpSendError("OUTREACH_DELIVERY_FAILED")).toBe(
      "OUTREACH_DELIVERY_FAILED",
    );
    expect(classifyFollowUpSendError("MAX_ROUNDS")).toBe("MAX_ROUNDS");
    expect(classifyFollowUpSendError("NEEDS_OUTREACH_EMAIL")).toBe("NEEDS_OUTREACH_EMAIL");
    expect(classifyFollowUpSendError("mystery")).toBe("generic");
  });
});

describe("followUpDeliveryState", () => {
  it("only claims delivered when SMTP accepted", () => {
    expect(followUpDeliveryState({ sent: true, delivered: true })).toBe("delivered");
    expect(followUpDeliveryState({ sent: true, delivered: false, reason: "QUEUED" })).toBe(
      "queued",
    );
    expect(followUpDeliveryState({ sent: true, delivered: false })).toBe("queued");
    expect(followUpDeliveryState({})).toBeNull();
  });
});
