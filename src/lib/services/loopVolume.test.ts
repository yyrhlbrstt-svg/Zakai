import { describe, expect, it } from "vitest";
import { buildVerticalStats, pct } from "@/lib/services/loopVolume";

describe("pct", () => {
  it("returns null when denominator is zero", () => {
    expect(pct(0, 0)).toBeNull();
    expect(pct(5, 0)).toBeNull();
  });

  it("rounds to whole percent", () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(3, 3)).toBe(100);
  });
});

describe("buildVerticalStats", () => {
  it("computes open→sent and sent→proof rates", () => {
    const rows = buildVerticalStats(
      [
        { id: "a", status: "OPEN", vertical: "telecom" },
        { id: "b", status: "SENT", vertical: "telecom" },
        { id: "c", status: "SAVED", vertical: "telecom" },
        { id: "d", status: "SENT", vertical: "subscription" },
      ],
      new Set(["c"]),
    );

    const money = rows.find((r) => r.id === "money");
    expect(money?.opened).toBe(3);
    expect(money?.mandatesSent).toBe(2);
    expect(money?.proofsDocumented).toBe(1);
    expect(money?.sendRatePct).toBe(67);
    expect(money?.proofRatePct).toBe(50);

    const cancel = rows.find((r) => r.id === "cancel");
    expect(cancel?.opened).toBe(1);
    expect(cancel?.mandatesSent).toBe(1);
    expect(cancel?.proofsDocumented).toBe(0);
    expect(cancel?.sendRatePct).toBe(100);
    expect(cancel?.proofRatePct).toBe(0);
  });

  it("ignores cases that match no main vertical", () => {
    const rows = buildVerticalStats(
      [{ id: "x", status: "SENT", vertical: "misc" }],
      new Set(["x"]),
    );
    expect(rows.every((r) => r.opened === 0 && r.mandatesSent === 0 && r.proofsDocumented === 0)).toBe(
      true,
    );
  });
});
