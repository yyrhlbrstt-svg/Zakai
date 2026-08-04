import { describe, expect, it } from "vitest";
import {
  classifyFollowUpSendError,
  followUpDeliveryState,
  followUpDispatchOutcome,
  isMandateBlockedFollowUpReason,
} from "./followUpSendUi";

describe("classifyFollowUpSendError", () => {
  it("maps known CaseError codes", () => {
    expect(classifyFollowUpSendError("OUTREACH_DELIVERY_FAILED")).toBe(
      "OUTREACH_DELIVERY_FAILED",
    );
    expect(classifyFollowUpSendError("MAX_ROUNDS")).toBe("MAX_ROUNDS");
    expect(classifyFollowUpSendError("NEEDS_OUTREACH_EMAIL")).toBe("NEEDS_OUTREACH_EMAIL");
    expect(classifyFollowUpSendError("MANDATE_REQUIRED")).toBe("NO_ACTIVE_MANDATE");
    expect(classifyFollowUpSendError("mystery")).toBe("generic");
  });

  it("treats MANDATE_REQUIRED like NO_ACTIVE_MANDATE for cron nudges", () => {
    expect(isMandateBlockedFollowUpReason("NO_ACTIVE_MANDATE")).toBe(true);
    expect(isMandateBlockedFollowUpReason("MANDATE_REQUIRED")).toBe(true);
    expect(isMandateBlockedFollowUpReason("NEEDS_OUTREACH_EMAIL")).toBe(false);
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

describe("followUpDispatchOutcome", () => {
  it("marks SMTP SENT as delivered and QUEUED as not delivered", () => {
    expect(followUpDispatchOutcome("SENT")).toEqual({ sent: true, delivered: true });
    expect(followUpDispatchOutcome("QUEUED")).toEqual({
      sent: true,
      delivered: false,
      reason: "QUEUED",
    });
  });
});
