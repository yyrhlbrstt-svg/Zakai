import { describe, expect, it } from "vitest";
import { letterFooter, withFooter } from "./letterFooter";

describe("the footer says only what is true without any record on our side", () => {
  it("never claims the letter is from us", () => {
    // It is from the person. We drafted it and they sent it, and implying
    // otherwise is the agent-claims-it-filed failure this codebase forbids.
    const he = letterFooter("he");
    expect(he).toContain("של השולח");
    expect(he).not.toMatch(/זכאי פנה|בשם הלקוח|הוגש על ידי זכאי/);
  });

  it("never offers a per-letter lookup", () => {
    // A verification code would mean storing every letter. These are generated
    // on the person's own device and never reach our servers, which is why most
    // of the product needs no account — trading that away for a marketing hook
    // would be the worst deal in the codebase.
    for (const locale of ["he", "en", "ar", "ru"] as const) {
      expect(letterFooter(locale)).not.toMatch(/code=|ref=|\/verify\//);
    }
  });

  it("points at the page an institution needs, in every language", () => {
    for (const locale of ["he", "en", "ar", "ru"] as const) {
      expect(letterFooter(locale)).toMatch(/\/(he|en)\/institutions$/m);
    }
  });

  it("addresses the institution rather than the reader of the claim", () => {
    // The footer's audience is a service desk drowning in manual work, not the
    // person who just wrote the letter.
    expect(letterFooter("he")).toMatch(/פניות רבות/);
    expect(letterFooter("en")).toMatch(/many of these/);
  });

  it("stays short enough to survive being sent", () => {
    // A long footer reads as advertising and gets deleted before sending, and a
    // footer that is cut is worth nothing — the whole mechanism depends on it
    // reaching the desk.
    for (const locale of ["he", "en", "ar", "ru"] as const) {
      expect(letterFooter(locale).split("\n").length).toBeLessThanOrEqual(4);
      expect(letterFooter(locale).length).toBeLessThan(320);
    }
  });
});

describe("appending", () => {
  it("adds the footer to a plain body", () => {
    const out = withFooter("שלום", "he");
    expect(out).toContain("שלום");
    expect(out).toContain("/he/institutions");
  });

  it("does not add it twice", () => {
    // Several assemblers build on each other's output — the captive letter, the
    // incident notice and the entitlement claim all flow through different
    // paths. A doubled footer looks like a bug to exactly the audience it is
    // meant to impress.
    const once = withFooter("שלום", "he");
    expect(withFooter(once, "he")).toBe(once);
    expect(once.match(/institutions/g)).toHaveLength(1);
  });

  it("keeps the body intact and trims only trailing space", () => {
    expect(withFooter("שורה\nשורה שנייה   \n\n", "he")).toContain("שורה\nשורה שנייה");
  });

  it("works in each language without leaking another's text", () => {
    expect(withFooter("x", "ru")).toContain("Zakai");
    expect(withFooter("x", "ru")).not.toContain("זכאי");
  });
});
