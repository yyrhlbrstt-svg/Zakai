import { describe, expect, it } from "vitest";
import he from "@/messages/he.json";
import en from "@/messages/en.json";

/**
 * Nothing may be "coming soon" once it has arrived.
 *
 * WHAT THIS CAUGHT
 *
 * The flight-claim page prepares a full statutory demand letter, names the
 * airline, fills in the sum and opens a case. Printed underneath it, in the
 * same card, was the sentence "coming soon: Zakai will prepare the full
 * demand for you." The feature had shipped and the copy underneath it still
 * said it had not, on the one page the founder was looking at when they said
 * the app was unclear. The coupon vault had the same problem: shipped,
 * reachable at /coupons, gated to Pro — and advertised on two pages as a
 * thing that might exist one day.
 *
 * A promise a product breaks by over-delivering still costs it: a reader who
 * is told the thing they are using does not exist yet concludes the writing
 * is not to be trusted, and they are right.
 *
 * There is no way to detect this automatically — no test knows which feature
 * shipped last week. So the rule is a register instead: every "coming soon"
 * in the catalogue is listed here with why it is still true, and a new one
 * cannot be added without writing that reason down. When one becomes false,
 * this is the file that fails.
 */

const STILL_TRUE: Record<string, string> = {
  "home.soonTitle": "heading of the explicitly-upcoming section on the homepage",
  "home.soonBadge": "the badge on that same section",
  "receipts.inboxTitle":
    "automatic mailbox scanning: needs Gmail OAuth, which in Israel needs a Financial Information Service Provider licence from the ISA — not close",
  "miluim.disclaimer":
    "filling the Bituach Leumi reserve-duty forms themselves; today the tool only estimates the amount",
  "institutions.whyAdoptBody":
    "describes what an institution's own customers will be doing, not a Zakai feature",
};

/** "coming soon" in either catalogue's language. */
const SOON = /בקרוב|coming soon/i;

function flatten(obj: unknown, prefix = "", out: Record<string, string> = {}) {
  if (typeof obj !== "object" || obj === null) return out;
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else flatten(value, path, out);
  }
  return out;
}

describe("coming-soon register", () => {
  const catalogues = { he: flatten(he), en: flatten(en) };

  it("finds the catalogues at all", () => {
    expect(Object.keys(catalogues.he).length).toBeGreaterThan(500);
    expect(Object.keys(catalogues.en).length).toBeGreaterThan(500);
  });

  it("every promise of a future feature is registered with a reason", () => {
    const unregistered: string[] = [];
    for (const [locale, flat] of Object.entries(catalogues)) {
      for (const [path, text] of Object.entries(flat)) {
        if (!SOON.test(text)) continue;
        if (STILL_TRUE[path]) continue;
        unregistered.push(`${locale}:${path} — "${text.slice(0, 90)}"`);
      }
    }
    expect(
      unregistered,
      unregistered.length
        ? `These promise something "coming soon" and are not in the register. If ` +
          `the feature has shipped, delete the promise and say what is true. If ` +
          `it genuinely has not, add it to STILL_TRUE with the reason:\n  ` +
          unregistered.join("\n  ")
        : "",
    ).toEqual([]);
  });

  it("the register has no stale entries", () => {
    // An entry for copy that no longer says "coming soon" is a licence sitting
    // there for the next person to reuse without thinking.
    for (const path of Object.keys(STILL_TRUE)) {
      const text = catalogues.he[path] ?? catalogues.en[path];
      expect(text, `${path} is registered but no longer exists`).toBeTruthy();
      expect(SOON.test(text!), `${path} no longer promises anything — drop it here`).toBe(true);
    }
  });
});
