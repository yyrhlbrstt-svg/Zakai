import { describe, it, expect } from "vitest";
import he from "@/messages/he.json";
import en from "@/messages/en.json";
import { CATALOG } from "@/lib/priority";

/**
 * The hero of a consumer entry page may not be written in our vocabulary.
 *
 * WHY THIS TEST EXISTS
 *
 * `/money` is the screen this whole product funnels into. Measured on an
 * iPhone 13 it opened with:
 *
 *   kicker  "כסף שיוצא סתם כל חודש"
 *   title   "בנק · סלולר · מנויים — בכתב עם Mandate"
 *   sub     "מצאו חיוב חוזר → תיק → Mandate → שליחה → SavingsProof.
 *            עמלה רק על חיסכון מתועד. בלי מוקד."
 *
 * Every one of "Mandate", "SavingsProof" and the arrow pipeline is a name we
 * invented for ourselves. They are accurate. They are also meaningless to the
 * person the page is for, who has never read this repository and arrived
 * because something is being charged to their card. The homepage was the same
 * — "צלמו חשבונית. הסוכן פותח תיק ו־Mandate." — and that string is also the
 * splash tagline, so it was the literal first sentence of the product.
 *
 * Tellingly, ar/de/fr/ru had plain copy the whole time ("You're overpaying.
 * Zakai gets it back."). Only the two languages the team writes in had drifted
 * into the internal dictionary — which is exactly how this happens: you stop
 * hearing the jargon in your own language.
 *
 * WHAT IT DOES AND DOES NOT COVER
 *
 * Only the named keys below: the kicker/title/sub/CTA of consumer entry
 * pages. Institutional and developer pages (`/institutions`, `/agents`,
 * `/registry`, `/partners`) say "Mandate" and "JWKS" on purpose — those
 * readers are integrating against it, and softening the word there would be
 * the opposite mistake. This is a plain-language rule for the front door, not
 * a ban on the vocabulary.
 */

/** Terms only somebody who works here — or reads our docs — would know. */
const INTERNAL_VOCABULARY = [
  "Mandate",
  "SavingsProof",
  "StrategyOutcome",
  "Money OS",
  "JWKS",
  "API",
];

/** Kicker / headline / sub / primary CTA of every consumer entry page. */
const CONSUMER_HERO_KEYS = [
  "home.kicker",
  "home.title1",
  "home.title2",
  "home.sub",
  "home.cta",
  "inline_app_locale_money_page.t_98667843",
  "inline_app_locale_money_page.t_2144de53",
  "inline_app_locale_money_page.t_ef77bbd3",
  "inline_app_locale_money_page.heroCta",
  "inline_app_locale_money_page.heroCtaPaste",
  "inline_app_locale_cancel_page.t_97c08415",
  "inline_app_locale_cancel_page.t_9af4e618",
  "inline_app_locale_leaks_page.t_c4b012f6",
  "inline_app_locale_leaks_page.t_2d4d4d1b",
  "inline_app_locale_start_page.t_eb8bdcd9",
  "inline_app_locale_start_page.t_b39acbd2",
] as const;

function lookup(bundle: unknown, path: string): string | undefined {
  let node: unknown = bundle;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

const BUNDLES: readonly [string, unknown][] = [
  ["he", he],
  ["en", en],
];

describe("consumer hero copy stays in the reader's words", () => {
  it("names a string that actually exists for every guarded key", () => {
    // A key that has been renamed away silently turns this whole file into a
    // test that examines nothing, which is the failure mode that lets the
    // jargon back in.
    for (const [locale, bundle] of BUNDLES) {
      for (const key of CONSUMER_HERO_KEYS) {
        expect(lookup(bundle, key), `${locale}: ${key} is missing`).toBeTypeOf("string");
      }
    }
  });

  for (const term of INTERNAL_VOCABULARY) {
    it(`never says "${term}" in a consumer hero`, () => {
      const offenders: string[] = [];
      for (const [locale, bundle] of BUNDLES) {
        for (const key of CONSUMER_HERO_KEYS) {
          const value = lookup(bundle, key);
          if (value && value.includes(term)) offenders.push(`${locale}: ${key} → ${value}`);
        }
      }
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }

  /**
   * The same rule, one level down.
   *
   * `CATALOG`'s `whyHe`/`whyEn` are the single most-repeated user-facing
   * sentence in the product: they are the subtitle under every card on
   * `/leaks`, `/start` and the "what's worth doing now" block on `/money`.
   * Roughly a third of them were written as our state machine — "תיק +
   * הרשאה + מעקב + תיעוד חיסכון", "Case + Mandate + send + documented
   * saving" — sitting directly beneath a headline promising the reader money.
   * The newer half of the same file ("קצבה חודשית לכל החיים — רוב הזכאים לא
   * הגישו תביעה") shows what the whole file should sound like.
   */
  const B2B_IDS = new Set(["integrations", "institutions", "partners", "agents", "registry"]);
  const consumerCatalog = CATALOG.filter((a) => !B2B_IDS.has(a.id));

  for (const term of INTERNAL_VOCABULARY) {
    it(`never says "${term}" on a consumer action card`, () => {
      const offenders: string[] = [];
      for (const a of consumerCatalog) {
        for (const [field, value] of [
          ["whyHe", a.whyHe],
          ["whyEn", a.whyEn],
          ["titleHe", a.titleHe],
          ["titleEn", a.titleEn],
        ] as const) {
          if (typeof value === "string" && value.includes(term)) {
            offenders.push(`${a.id}.${field} → ${value}`);
          }
        }
      }
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }

  it("does not point a reader at one of our own URLs mid-sentence", () => {
    // "הלולאה המלאה ב-/check" told somebody to go read a path. A card is a
    // door: it should say what is behind it and let the tap do the routing.
    const offenders: string[] = [];
    for (const a of consumerCatalog) {
      for (const [field, value] of [
        ["whyHe", a.whyHe],
        ["whyEn", a.whyEn],
      ] as const) {
        if (typeof value === "string" && /\s\/[a-z][a-z-]{2,}/.test(value)) {
          offenders.push(`${a.id}.${field} → ${value}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("does not describe the product as a pipeline of arrows", () => {
    // "צילום → תיק → Mandate → שליחה → SavingsProof" is an architecture
    // diagram. Nobody arrives wanting to know our sequence of internal states.
    const offenders: string[] = [];
    for (const [locale, bundle] of BUNDLES) {
      for (const key of CONSUMER_HERO_KEYS) {
        const value = lookup(bundle, key) ?? "";
        const arrows = (value.match(/[→←]/g) ?? []).length;
        if (arrows >= 2) offenders.push(`${locale}: ${key} → ${value}`);
      }
    }
    for (const a of consumerCatalog) {
      // One arrow is enough on a card: the whole line is two words long, so
      // "Screenshot → agent opens Mandate case" is already the diagram.
      for (const [field, value] of [
        ["whyHe", a.whyHe],
        ["whyEn", a.whyEn],
      ] as const) {
        if (typeof value === "string" && /[→←]/.test(value)) {
          offenders.push(`${a.id}.${field} → ${value}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
