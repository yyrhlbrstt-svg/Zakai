import { describe, expect, it } from "vitest";
import {
  buildInboundReceivePayload,
  intentForVertical,
  inboundReceiveEmailAttachment,
} from "./inboundPayload";

describe("inboundPayload", () => {
  it("maps verticals to intents", () => {
    expect(intentForVertical("telecom")).toBe("retention");
    expect(intentForVertical("car-insurance-refund")).toBe("dispute");
    expect(intentForVertical("electricity")).toBe("switch");
    expect(intentForVertical("subscription", "ביטול מנוי")).toBe("cancel");
  });

  it("builds attachment matching inbound-receive required fields", () => {
    const payload = buildInboundReceivePayload({
      mandateJws: "eyJhbGciOiJFZERTQSJ9.a.b",
      mandateJti: "jti-1",
      authorizationCode: "ZK-AAAA-BBBB",
      caseId: "case_1",
      vertical: "subscription",
      strategyHint: "ביטול",
      locale: "he-IL",
      market: "IL",
    });
    expect(payload.mandate_jws).toBeTruthy();
    expect(payload.mandate_jti).toBe("jti-1");
    expect(payload.intent).toBe("cancel");
    expect(payload.vertical).toBe("subscription");
    const att = inboundReceiveEmailAttachment(payload);
    expect(att.contentType).toMatch(/json/);
    expect(JSON.parse(String(att.content)).mandate_jti).toBe("jti-1");
  });
});
