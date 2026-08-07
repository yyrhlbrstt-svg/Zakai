import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PLANS, type PlanId } from "./plans";

/**
 * The advertised success fee must equal the one the code charges.
 *
 * Every plan's fee is written as prose in the message catalogues — "עמלת הצלחה
 * 18%" — while the number actually charged lives in `PLANS[id].feeRateBps`.
 * Nothing connected the two. Change a rate in plans.ts and the pricing page
 * keeps advertising the old one indefinitely, in six languages, with no test
 * failing and nobody noticing until a customer is billed a percentage the site
 * never quoted them.
 *
 * For a product whose entire proposition is "we take a documented cut of money
 * we actually recovered", a stale percentage on the pricing page is not a copy
 * bug. It is the company misquoting its own price.
 *
 * This reads the rate out of the copy and compares it to the source of truth,
 * for every plan and every locale that translates it.
 */
const LOCALES = ["he", "en", "ar", "ru", "de", "fr"] as const;

/** Percent as written in prose, e.g. 1800 bps -> 18. */
function percentOf(planId: PlanId): number {
  return PLANS[planId].feeRateBps / 100;
}

interface FeeCopy {
  locale: string;
  planId: PlanId;
  text: string;
}

function feeStrings(): FeeCopy[] {
  const out: FeeCopy[] = [];
  for (const locale of LOCALES) {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(readFileSync(`src/messages/${locale}.json`, "utf8"));
    } catch {
      continue; // a locale that does not ship yet is not a failure here
    }
    const plans = (json.pricing as { plans?: Record<string, { fee?: string }> } | undefined)?.plans;
    if (!plans) continue;
    for (const [planId, entry] of Object.entries(plans)) {
      if (!entry?.fee) continue;
      if (!(planId in PLANS)) continue;
      out.push({ locale, planId: planId as PlanId, text: entry.fee });
    }
  }
  return out;
}

describe("advertised success fee matches what is charged", () => {
  const strings = feeStrings();

  it("finds fee copy to check, so the assertions below are not vacuous", () => {
    // Without this, renaming the `pricing.plans.*.fee` key would silently turn
    // the whole suite into a no-op that keeps passing.
    expect(strings.length).toBeGreaterThan(3);
  });

  it("quotes every plan's real rate, in every locale that mentions one", () => {
    const wrong: string[] = [];

    for (const { locale, planId, text } of strings) {
      const expected = percentOf(planId);
      // Any percentage figure appearing in the sentence, Arabic-Indic digits
      // included, since ar.json may use them.
      const found = [...text.matchAll(/([\d٠-٩]+(?:[.,][\d٠-٩]+)?)\s*%/g)].map(
        (m) => Number(normalizeDigits(m[1]).replace(",", ".")),
      );

      if (found.length === 0) {
        // A plan may legitimately describe a zero fee without a "%" figure.
        if (expected !== 0) wrong.push(`${locale}/${planId}: no percentage in "${text}"`);
        continue;
      }
      if (!found.includes(expected)) {
        wrong.push(
          `${locale}/${planId}: copy says ${found.join("/")}%, PLANS says ${expected}% — "${text}"`,
        );
      }
    }

    expect(wrong, `Pricing copy disagrees with plans.ts:\n${wrong.join("\n")}`).toEqual([]);
  });

  it("never advertises a zero fee for a plan that charges one", () => {
    // The costliest direction to get wrong: someone reads "0% fee" and is
    // then billed.
    for (const { locale, planId, text } of strings) {
      if (PLANS[planId].feeRateBps === 0) continue;
      expect(
        /(^|[^\d])0\s*%/.test(normalizeDigits(text)),
        `${locale}/${planId} advertises 0% but charges ${percentOf(planId)}%`,
      ).toBe(false);
    }
  });
});

function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
