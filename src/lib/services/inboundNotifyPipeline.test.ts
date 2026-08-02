import { describe, expect, it } from "vitest";
import { resolveInboundRecordAmountShekels } from "@/lib/fee";
import { shouldNotifyInbound } from "@/lib/inboundDecision";
import { feeBasisForVertical } from "@/lib/verticals";

/**
 * Regression guard for the closed proof loop: lump verticals + code match
 * must surface one-tap record even when AI confidence is below email threshold.
 */
describe("inbound email notify pipeline", () => {
  it("deposit lump + code match + refund extract → record 0 and notify", () => {
    expect(feeBasisForVertical("deposit")).toBe("lump");
    const record = resolveInboundRecordAmountShekels("lump", 8000, 8000, "refund");
    expect(record).toBe(0);
    expect(
      shouldNotifyInbound({
        matchMethod: "code",
        found: true,
        newAmountShekels: 8000,
        confidence: 0.55,
      }),
    ).toBe(true);
  });

  it("warranty lump partial refund maps remaining owed", () => {
    expect(feeBasisForVertical("warranty")).toBe("lump");
    const record = resolveInboundRecordAmountShekels("lump", 2500, 500, "refund");
    expect(record).toBe(2000);
  });

  it("email-only match still requires confidence", () => {
    expect(
      shouldNotifyInbound({
        matchMethod: "email",
        found: true,
        newAmountShekels: 100,
        confidence: 0.55,
      }),
    ).toBe(false);
  });
});
