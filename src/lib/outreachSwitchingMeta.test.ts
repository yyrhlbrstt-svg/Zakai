import { describe, expect, it } from "vitest";
import { buildOutreachProtocolFooter, switchingProfileForCase } from "./outreachSwitchingMeta";

describe("outreachSwitchingMeta", () => {
  it("maps telecom vertical to reference profile", () => {
    const p = switchingProfileForCase({ vertical: "telecom", market: "IL" });
    expect(p?.id).toBe("telecom-disconnect-il-1");
  });

  it("includes jti when present", () => {
    const block = buildOutreachProtocolFooter({
      appUrl: "https://example.test",
      authCode: "ZK-TEST",
      mandateJti: "abc-123",
      vertical: "telecom",
    });
    expect(block).toContain("mandate_jti: abc-123");
    expect(block).toContain("/api/mandate/status/abc-123");
  });
});
