import { describe, it, expect } from "vitest";
import { checkEligibility, isClaimOpen, matchEvents } from "@/lib/signal/eligibility";
import { validateEvent, EventInvalid } from "@/lib/signal/validate";
import type { MarketEvent } from "@/lib/signal/types";

const TODAY = "2026-08-13";

/** A shape that passes validation, so each test can break exactly one thing. */
function event(over: Partial<MarketEvent> = {}): MarketEvent {
  return {
    id: "example-refund-2026",
    kind: "regulatory_fine",
    counterparty: "example-bank",
    jurisdiction: "IL",
    headline: {
      he: "הבנק גבה עמלה שלא כדין וחויב להחזיר אותה",
      en: "The bank charged a fee unlawfully and was ordered to refund it",
    },
    occurredAt: "2026-03-01",
    source: {
      publisher: "בנק ישראל",
      url: "https://www.boi.org.il/example",
      publishedAt: "2026-04-01",
    },
    confidence: "confirmed",
    eligibility: { kind: "hasProvider", provider: "example-bank" },
    claim: { vertical: "bank-fees", path: "/bank-fees" },
    ...over,
  };
}

describe("an event nobody can check does not exist", () => {
  it("accepts a fully sourced event", () => {
    expect(() => validateEvent(event(), TODAY)).not.toThrow();
  });

  it("refuses a source that is not a link somebody can open", () => {
    for (const url of ["", "not-a-url", "http://insecure.example/x", "example.com"]) {
      expect(() =>
        validateEvent(event({ source: { ...event().source, url } }), TODAY),
      ).toThrow(EventInvalid);
    }
  });

  it("refuses an event published before it happened", () => {
    // Not a rounding error — the signature of a guessed date, and every claim
    // window is computed from these.
    expect(() =>
      validateEvent(
        event({ occurredAt: "2026-05-01", source: { ...event().source, publishedAt: "2026-04-01" } }),
        TODAY,
      ),
    ).toThrow(/published .* but occurred/);
  });

  it("refuses a source dated in the future", () => {
    expect(() =>
      validateEvent(event({ source: { ...event().source, publishedAt: "2027-01-01" } }), TODAY),
    ).toThrow(/in the future/);
  });

  it("refuses to call a secondary report confirmed", () => {
    // The difference is shown to the reader, so it has to mean something.
    expect(() =>
      validateEvent(
        event({
          confidence: "confirmed",
          source: { publisher: "אתר חדשות", url: "https://news.example/x", publishedAt: "2026-04-01" },
        }),
        TODAY,
      ),
    ).toThrow(/not a primary source/);
  });

  it("allows the same secondary source when it says so", () => {
    expect(() =>
      validateEvent(
        event({
          confidence: "reported",
          source: { publisher: "אתר חדשות", url: "https://news.example/x", publishedAt: "2026-04-01" },
        }),
        TODAY,
      ),
    ).not.toThrow();
  });

  it("refuses an event that does not end in something the person can do", () => {
    expect(() =>
      validateEvent(event({ claim: { vertical: "bank-fees", path: "ask a lawyer" } }), TODAY),
    ).toThrow(/in-app route/);
  });

  it("refuses a claim window that closed before the event happened", () => {
    expect(() =>
      validateEvent(
        event({ claim: { vertical: "bank-fees", path: "/bank-fees", deadline: "2026-01-01" } }),
        TODAY,
      ),
    ).toThrow(/closed before the event/);
  });

  it("refuses a fixed amount that is not whole agorot", () => {
    for (const amount of [0, -100, 12.5]) {
      expect(() =>
        validateEvent(
          event({ claim: { vertical: "bank-fees", path: "/bank-fees", fixedAmountAgorot: amount } }),
          TODAY,
        ),
      ).toThrow(/agorot/);
    }
  });

  it("refuses a headline too short to tell anybody anything", () => {
    expect(() => validateEvent(event({ headline: { ...event().headline, he: "משהו" } }), TODAY)).toThrow(/too short/);
  });
});

describe("who it applies to, and why", () => {
  const facts = {
    country: "IL",
    providers: ["example-bank", "cellcom"],
    providerWindows: { "example-bank": ["2019-01-01", "2026-01-01"] as const },
    verticals: ["bank-fees"],
  };

  it("explains every match in the reader's own terms", () => {
    const result = checkEligibility(
      {
        kind: "all",
        rules: [
          { kind: "inCountry", country: "IL" },
          { kind: "hadProviderBetween", provider: "example-bank", from: "2020-01-01", to: "2025-12-31" },
        ],
      },
      facts,
    );
    expect(result.matched).toBe(true);
    expect(result.because).toHaveLength(2);
    expect(result.because).toContainEqual(
      expect.objectContaining({ provider: "example-bank" }),
    );
  });

  it("leaves no half explanation behind when an `all` rule fails", () => {
    // The country matched. If that reason survived the failure, somebody would
    // be told they qualify "because they are in Israel".
    const result = checkEligibility(
      {
        kind: "all",
        rules: [
          { kind: "inCountry", country: "IL" },
          { kind: "hasProvider", provider: "not-their-bank" },
        ],
      },
      facts,
    );
    expect(result.matched).toBe(false);
    expect(result.because).toEqual([]);
  });

  it("does not attach a failed branch's reason to a match made elsewhere", () => {
    /**
     * Pins the observable contract: the first branch of the `any` fails
     * halfway — after its country check passed — and the second branch is
     * what actually matches. The reader must be told they qualify because of
     * their bank, not partly "because they are in Israel", which is not why.
     *
     * Worth recording what trying to break this proved: removing the `if (ok)`
     * guard inside the `all` branch does not fail any of these tests, because
     * every enclosing scope already discards a failed child's reasons. That
     * guard is defence in depth, not the thing holding this up. The property
     * is real and worth pinning; the belief that one line was load-bearing
     * was not.
     */
    const result = checkEligibility(
      {
        kind: "any",
        rules: [
          {
            kind: "all",
            rules: [
              { kind: "inCountry", country: "IL" },
              { kind: "hasProvider", provider: "not-their-bank" },
            ],
          },
          { kind: "hasProvider", provider: "example-bank" },
        ],
      },
      facts,
    );
    expect(result.matched).toBe(true);
    expect(result.because).toEqual([{ code: "hasProvider", provider: "example-bank" }]);
  });

  it("needs the relationship to overlap the window, not merely to exist", () => {
    const outside = checkEligibility(
      { kind: "hadProviderBetween", provider: "example-bank", from: "2027-01-01", to: "2027-12-31" },
      facts,
    );
    expect(outside.matched).toBe(false);
  });

  it("will not match a window for a provider whose dates we do not know", () => {
    // cellcom is in `providers` but has no window. Guessing that it overlapped
    // is how somebody gets told they are owed money that they are not.
    const result = checkEligibility(
      { kind: "hadProviderBetween", provider: "cellcom", from: "2020-01-01", to: "2025-01-01" },
      facts,
    );
    expect(result.matched).toBe(false);
  });

  it("reports eligibility and an expired window as two different facts", () => {
    const expired = event({
      claim: { vertical: "bank-fees", path: "/bank-fees", deadline: "2026-06-01" },
    });
    expect(checkEligibility(expired.eligibility, facts).matched).toBe(true);
    expect(isClaimOpen(expired, new Date("2026-08-13T00:00:00Z"))).toBe(false);
  });

  it("treats the deadline as a day, not an instant", () => {
    const closing = event({
      claim: { vertical: "bank-fees", path: "/bank-fees", deadline: "2026-08-13" },
    });
    expect(isClaimOpen(closing, new Date("2026-08-13T23:00:00Z"))).toBe(true);
    expect(isClaimOpen(closing, new Date("2026-08-14T00:00:00Z"))).toBe(false);
  });

  it("returns matching events newest first, each carrying its reasons", () => {
    const older = event({ id: "older-2024", occurredAt: "2024-01-01" });
    const newer = event({ id: "newer-2026", occurredAt: "2026-03-01" });
    const missing = event({
      id: "other-bank",
      eligibility: { kind: "hasProvider", provider: "somebody-else" },
    });
    const rows = matchEvents([older, newer, missing], facts, new Date("2026-08-13T00:00:00Z"));
    expect(rows.map((r) => r.event.id)).toEqual(["newer-2026", "older-2024"]);
    expect(rows.every((r) => r.because.length > 0)).toBe(true);
  });
});

describe("a reason is a code and its facts, never a sentence", () => {
  /**
   * These were Hebrew sentences built inside this pure module, which handed an
   * Arabic or Russian reader the one line justifying a claim on their money in
   * a language they may not read — and nothing would have shown up as a
   * missing translation, because from the catalogue's side nothing was
   * missing. Codes are also the machine-readable record of why we said it,
   * which is what somebody asks for six months later.
   */
  it("reports the country as a code, for the screen to translate", () => {
    const { because } = checkEligibility(
      { kind: "inCountry", country: "IL" },
      { country: "IL", providers: [] },
    );
    expect(because).toEqual([{ code: "inCountry", country: "IL" }]);
  });

  it("reports an unknown market too, and lets the screen decide the words", () => {
    const { because } = checkEligibility(
      { kind: "inCountry", country: "ZZ" },
      { country: "ZZ", providers: [] },
    );
    expect(because[0]).toEqual({ code: "inCountry", country: "ZZ" });
  });
});
