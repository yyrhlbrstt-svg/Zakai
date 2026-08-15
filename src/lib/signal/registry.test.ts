import { describe, it, expect } from "vitest";
import { MARKET_EVENTS, validateRegistry, eventsForMarket } from "@/lib/signal/registry";
import type { MarketEvent } from "@/lib/signal/types";

/**
 * The gate, tested against the ways somebody would actually get it wrong.
 *
 * These are not schema tests. Each one is a specific bad entry that a person
 * in a hurry would write, and the assertion is that it cannot reach a screen
 * where it would tell somebody they are owed money.
 */

const GOOD: MarketEvent = {
  id: "example-fine-2026",
  kind: "regulatory_fine",
  counterparty: "example-bank",
  jurisdiction: "IL",
  headline: {
    he: "הרגולטור קבע שנגבתה עמלה שלא כדין, ומגיע החזר.",
    en: "The regulator found a fee was charged unlawfully, and a refund is due.",
  },
  occurredAt: "2026-03-01",
  source: {
    publisher: "בנק ישראל",
    url: "https://www.boi.org.il/example",
    publishedAt: "2026-03-15",
  },
  confidence: "confirmed",
  eligibility: {
    kind: "all",
    rules: [
      { kind: "inCountry", country: "IL" },
      { kind: "hadProviderBetween", provider: "example-bank", from: "2020-01-01", to: "2026-03-01" },
    ],
  },
  claim: { vertical: "bank-fees", path: "/bank-fees", deadline: "2027-03-01" },
};

const TODAY = "2026-08-13";

describe("the registry ships empty, on purpose", () => {
  it("contains no events written from memory", () => {
    // If this ever fails, read the comment at the top of registry.ts before
    // "fixing" it. An entry is only allowed here with its source open.
    expect(MARKET_EVENTS).toEqual([]);
  });

  it("validates whatever it does contain", () => {
    expect(() => validateRegistry(MARKET_EVENTS, TODAY)).not.toThrow();
  });
});

describe("what the gate refuses", () => {
  const reject = (patch: Partial<MarketEvent>, why: RegExp) => {
    expect(() => validateRegistry([{ ...GOOD, ...patch }], TODAY)).toThrow(why);
  };

  it("accepts a well-formed event, so the refusals below mean something", () => {
    expect(() => validateRegistry([GOOD], TODAY)).not.toThrow();
  });

  it("refuses an event with no source url a person can open", () => {
    reject({ source: { ...GOOD.source, url: "internal note" } }, /https link/);
  });

  it("refuses an http url, since a citation is a thing people click", () => {
    reject({ source: { ...GOOD.source, url: "http://boi.org.il/x" } }, /https link/);
  });

  it("refuses an unnamed publisher", () => {
    reject({ source: { ...GOOD.source, publisher: "  " } }, /rumour with a schema/);
  });

  it('refuses "confirmed" when the publisher is not a primary source', () => {
    // A newspaper reporting a fine is not the fine. It may still be published
    // — as "reported", which the reader is shown.
    reject(
      { source: { ...GOOD.source, publisher: "כלכליסט", url: "https://calcalist.co.il/x" } },
      /not a primary source/,
    );
  });

  it("allows the same story as reported rather than confirmed", () => {
    expect(() =>
      validateRegistry(
        [
          {
            ...GOOD,
            confidence: "reported",
            source: { ...GOOD.source, publisher: "כלכליסט", url: "https://calcalist.co.il/x" },
          },
        ],
        TODAY,
      ),
    ).not.toThrow();
  });

  it("refuses a source dated before the thing it describes", () => {
    // The signature of a guessed date, and every claim window is computed
    // from these two numbers.
    reject({ occurredAt: "2026-06-01" }, /published .* but occurred/);
  });

  it("refuses a source dated in the future", () => {
    reject({ source: { ...GOOD.source, publishedAt: "2027-01-01" } }, /in the future/);
  });

  it("refuses a claim that ends outside the app", () => {
    reject({ claim: { ...GOOD.claim, path: "https://gov.il/form" } }, /in-app route/);
  });

  it("refuses a claim window that closed before the event happened", () => {
    reject({ claim: { ...GOOD.claim, deadline: "2019-01-01" } }, /closed before/);
  });

  it("refuses a fixed amount that is not whole agorot", () => {
    reject({ claim: { ...GOOD.claim, fixedAmountAgorot: 12.5 } }, /positive integer in agorot/);
  });

  it("refuses a headline too short to tell anybody anything", () => {
    reject({ headline: { ...GOOD.headline, he: "החזר" } }, /too short/);
  });

  it("refuses a headline longer than a sentence", () => {
    reject({ headline: { ...GOOD.headline, en: "x".repeat(200) } }, /longer than a sentence/);
  });

  it("refuses an event with no Hebrew headline in a Hebrew-first product", () => {
    reject({ headline: { en: GOOD.headline.en } }, /headline\.he is missing/);
  });

  it("checks a third locale too, so a bad translation cannot hide behind a good pair", () => {
    reject({ headline: { ...GOOD.headline, ru: "нет" } }, /headline\.ru is too short/);
  });

  it("refuses two events sharing an id", () => {
    expect(() => validateRegistry([GOOD, { ...GOOD }], TODAY)).toThrow(/duplicate event id/);
  });
});

describe("eventsForMarket", () => {
  it("filters by jurisdiction and orders newest first", () => {
    const older: MarketEvent = { ...GOOD, id: "older-event", occurredAt: "2025-01-01" };
    const elsewhere: MarketEvent = { ...GOOD, id: "gb-event", jurisdiction: "GB" };
    const rows = eventsForMarket("il", [older, elsewhere, GOOD]);
    expect(rows.map((r) => r.id)).toEqual(["example-fine-2026", "older-event"]);
  });
});
