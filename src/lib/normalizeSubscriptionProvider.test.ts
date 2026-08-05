import { describe, expect, it } from "vitest";
import {
  pickOutreachEmail,
  resolveSubscriptionCompany,
  subscriptionOutreachReady,
} from "./normalizeSubscriptionProvider";

describe("resolveSubscriptionCompany", () => {
  it("maps Netflix", () => {
    const r = resolveSubscriptionCompany("נטפליקס", "פרימיום");
    expect(r.providerKey).toBe("netflix");
    expect(r.defaultContactEmail).toBe("info@netflix.com");
  });

  it("maps Spotify", () => {
    const r = resolveSubscriptionCompany("Spotify", "");
    expect(r.providerKey).toBe("spotify");
    expect(r.defaultContactEmail).toBe("support@spotify.com");
  });

  it("maps Cellcom with public support inbox", () => {
    const r = resolveSubscriptionCompany("סלקום", "מנוי");
    expect(r.providerKey).toBe("cellcom");
    expect(r.defaultContactEmail).toMatch(/@cellcom/);
  });

  it("falls back to display name for unknown merchant", () => {
    const r = resolveSubscriptionCompany("חדר כושר XYZ", "מנוי");
    expect(r.providerKey).toBe("חדר כושר XYZ");
    expect(r.defaultContactEmail).toBeUndefined();
  });
});

describe("pickOutreachEmail", () => {
  it("prefers explicit contact email", () => {
    expect(
      pickOutreachEmail({
        contactEmail: "billing@merchant.com",
        accountOrEmail: "user@x.com",
        defaultContactEmail: "info@netflix.com",
      }),
    ).toBe("billing@merchant.com");
  });

  it("returns null when nothing valid", () => {
    expect(pickOutreachEmail({ accountOrEmail: "12345" })).toBeNull();
  });
});

describe("subscriptionOutreachReady", () => {
  it("ready for Netflix without user email", () => {
    expect(subscriptionOutreachReady("Netflix", "plan")).toBe(true);
  });

  it("ready for Cellcom without user email", () => {
    expect(subscriptionOutreachReady("סלקום", "מנוי")).toBe(true);
  });

  it("not ready for unknown without contact", () => {
    expect(subscriptionOutreachReady("Gym XYZ", "מנוי")).toBe(false);
  });

  it("ready when user supplies contact", () => {
    expect(subscriptionOutreachReady("Gym XYZ", "מנוי", "support@gym.co.il")).toBe(true);
  });
});
