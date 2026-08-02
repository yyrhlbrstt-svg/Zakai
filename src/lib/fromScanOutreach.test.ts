import { describe, expect, it } from "vitest";
import {
  buildFromScanDraft,
  defaultScanIntent,
  resolveFromScanOutreach,
  scanVertical,
} from "./fromScanOutreach";

describe("fromScanOutreach", () => {
  it("maps cellular to telecom vertical", () => {
    expect(scanVertical("cellular")).toBe("telecom");
    expect(defaultScanIntent("cellular")).toBe("retention");
  });

  it("resolves Cellcom outreach without manual email", () => {
    const r = resolveFromScanOutreach({
      merchant: "Cellcom",
      product: "5G",
      category: "cellular",
    });
    expect(r.vertical).toBe("telecom");
    expect(r.outreachTo).toBe("service@cellcom.co.il");
  });

  it("requires contact for unknown merchant subscription", () => {
    const r = resolveFromScanOutreach({
      merchant: "Random SaaS Ltd",
      product: "Pro",
      category: "digital",
    });
    expect(r.vertical).toBe("subscription");
    expect(r.outreachTo).toBeNull();
  });

  it("builds draft with mandate footer locale", () => {
    const d = buildFromScanDraft({
      customerName: "Test User",
      merchant: "Netflix",
      product: "Premium",
      monthlyShekels: 50,
      intent: "cancel",
      country: "IL",
    });
    expect(d.subject.length).toBeGreaterThan(5);
    expect(d.draftMessage).toContain("Test User");
  });
});
