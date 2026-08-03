import { describe, expect, it } from "vitest";
import { buildJoinKitDocument } from "./joinKit";

describe("buildJoinKitDocument", () => {
  it("exposes all four audiences without inventing institutions", () => {
    const doc = buildJoinKitDocument("https://zakai.example");
    expect(doc.spec).toBe("zakai-network-join-kit");
    expect(doc.audiences.institution.urls.inbound_receive).toContain("/inbound-receive");
    expect(doc.audiences.institution.urls.pipe_accept).toContain("/api/pipe/accept");
    expect(doc.audiences.institution.urls.pipe_mark).toContain("/api/pipe/mark");
    expect(doc.audiences.issuer.urls.evidence).toContain("/evidence");
    expect(doc.audiences.agent.urls.must_have).toContain("/must-have");
    expect(doc.audiences.developer.urls.packs_mirror).toContain("/api/cdn/packs");
    expect(doc.honesty).toMatch(/never auto-filled/i);
  });
});
