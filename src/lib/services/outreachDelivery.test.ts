import { describe, expect, it } from "vitest";
import { mapOutboxToOutreachDelivery } from "./outreachDelivery";

describe("mapOutboxToOutreachDelivery", () => {
  it("maps Outbox statuses honestly", () => {
    expect(mapOutboxToOutreachDelivery({ status: "SENT" })).toBe("delivered");
    expect(mapOutboxToOutreachDelivery({ status: "QUEUED" })).toBe("queued");
    expect(mapOutboxToOutreachDelivery({ status: "FAILED" })).toBe("failed");
    expect(mapOutboxToOutreachDelivery(null)).toBe("none");
  });

  it("treats no-transport marker as failed, inbound as none", () => {
    expect(
      mapOutboxToOutreachDelivery({ status: "FAILED", providerMessageId: "no-transport" }),
    ).toBe("failed");
    expect(
      mapOutboxToOutreachDelivery({ status: "SENT", providerMessageId: "inbound" }),
    ).toBe("none");
  });
});
