import { describe, expect, it } from "vitest";
import { partnerRefFromSearchParams } from "./partnerAttribution";

describe("partnerRefFromSearchParams", () => {
  it("reads utm_campaign for embed source", () => {
    const p = new URLSearchParams("utm_source=embed&utm_campaign=bank-hapoalim");
    expect(partnerRefFromSearchParams(p)).toBe("bank-hapoalim");
  });

  it("reads utm_campaign for paid cpc", () => {
    const p = new URLSearchParams("utm_source=cpc&utm_campaign=cancel-meta-il");
    expect(partnerRefFromSearchParams(p)).toBe("cancel-meta-il");
  });

  it("reads pref short param without utm", () => {
    const p = new URLSearchParams("pref=influencer-dana");
    expect(partnerRefFromSearchParams(p)).toBe("influencer-dana");
  });

  it("ignores utm without allowlisted source", () => {
    const p = new URLSearchParams("utm_source=newsletter&utm_campaign=x");
    expect(partnerRefFromSearchParams(p)).toBeNull();
  });

  it("prefers ref_agent for pipe handoff attribution", () => {
    const p = new URLSearchParams(
      "utm_source=agent&utm_campaign=agent-generic&ref_agent=claude-code",
    );
    expect(partnerRefFromSearchParams(p)).toBe("agent-claude-code");
  });
});
