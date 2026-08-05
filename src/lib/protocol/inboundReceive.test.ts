import { describe, expect, it } from "vitest";
import { buildInboundReceiveDocument, INBOUND_RECEIVE_SPEC } from "./inboundReceive";

describe("inbound receive", () => {
  it("includes verify endpoints and mandate_jws required", () => {
    const doc = buildInboundReceiveDocument("https://zakai.example");
    expect(doc.spec).toBe(INBOUND_RECEIVE_SPEC);
    expect(doc.fields.find((f) => f.name === "mandate_jws")?.required).toBe(true);
    expect(doc.verify.jwks).toContain("zakai-jwks.json");
  });
});
