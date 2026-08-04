import { describe, expect, it } from "vitest";
import {
  isOutboxAccepted,
  isOutboxDelivered,
  outboxDeliveryState,
} from "./outboxDeliveryState";

describe("outboxDeliveryState", () => {
  it("classifies SENT / QUEUED / FAILED / empty", () => {
    expect(outboxDeliveryState("SENT")).toBe("sent");
    expect(outboxDeliveryState("QUEUED")).toBe("queued");
    expect(outboxDeliveryState("FAILED")).toBe("failed");
    expect(outboxDeliveryState(null)).toBe("none");
  });

  it("never treats QUEUED as delivered", () => {
    expect(isOutboxDelivered("QUEUED")).toBe(false);
    expect(isOutboxDelivered("SENT")).toBe(true);
    expect(isOutboxAccepted("QUEUED")).toBe(true);
    expect(isOutboxAccepted("FAILED")).toBe(false);
  });
});
