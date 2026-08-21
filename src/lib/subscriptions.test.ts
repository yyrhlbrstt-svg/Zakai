import { describe, it, expect } from "vitest";
import { parseStatement, detectRecurring, categorize, scanStatement, recurringConfidence} from "./subscriptions";
import { CLAIM_SPEAK_THRESHOLD } from "./claimGate";

/** A realistic Isracard-style export: Hebrew headers, dd/mm/yyyy, ₪ amounts. */
const CSV_HE = `תאריך עסקה,שם בית עסק,סכום עסקה,סכום חיוב
05/03/2026,סלקום בע"מ,89.90 ₪,89.90 ₪
05/04/2026,סלקום בע"מ,89.90 ₪,89.90 ₪
05/05/2026,סלקום בע"מ,89.90 ₪,89.90 ₪
12/03/2026,נטפליקס,54.90 ₪,54.90 ₪
12/04/2026,נטפליקס,54.90 ₪,54.90 ₪
20/03/2026,סופר יוחננוף סניף 12,432.10 ₪,432.10 ₪
02/05/2026,קפה גרג,38.00 ₪,38.00 ₪`;

describe("parseStatement", () => {
  /**
   * Bank exports write a charge as a debit — negative — where a card
   * statement writes the same event as a positive. Keeping only positives
   * meant a pasted bank export produced nothing at all, and the scan said
   * "no recurring charges found", which reads as "we cannot handle your
   * bank" rather than "wrong sign".
   */
  it("reads an all-negative bank export as charges, not as nothing", () => {
    const bankExport = [
      "01/05/2026,ישראכרט סליקה,-1240.00",
      "01/06/2026,ישראכרט סליקה,-1180.00",
      "01/07/2026,ישראכרט סליקה,-1250.00",
    ].join("\n");
    const txns = parseStatement(bankExport);
    expect(txns).toHaveLength(3);
    expect(txns.every((t) => t.amountAgorot > 0)).toBe(true);
    expect(txns[0].amountAgorot).toBe(124000);
  });

  it("still treats negatives as refunds when the statement also has positives", () => {
    // A card statement: charges positive, the refund line negative. The
    // refund must not become a fourth charge.
    const cardExport = [
      "01/05/2026,נטפליקס,54.90",
      "01/06/2026,נטפליקס,54.90",
      "01/07/2026,נטפליקס,-54.90",
    ].join("\n");
    const txns = parseStatement(cardExport);
    expect(txns).toHaveLength(2);
    expect(txns.every((t) => t.amountAgorot === 5490)).toBe(true);
  });

  it("parses Hebrew credit-card exports (day-first dates, ₪, headers skipped)", () => {
    const txns = parseStatement(CSV_HE);
    expect(txns).toHaveLength(7);
    expect(txns[0].merchant).toContain("סלקום");
    expect(txns[0].amountAgorot).toBe(8990);
    expect(txns[0].date.getMonth()).toBe(2); // March (day-first!)
    expect(txns[0].date.getDate()).toBe(5);
  });

  it("handles tab-separated and ISO dates", () => {
    const txns = parseStatement("2026-03-05\tSpotify AB\t23.90\n2026-04-05\tSpotify AB\t23.90");
    expect(txns).toHaveLength(2);
    expect(txns[0].amountAgorot).toBe(2390);
    expect(txns[0].merchant).toBe("Spotify AB");
  });

  it("uses the LAST money cell (actual billed amount) when several exist", () => {
    const txns = parseStatement("01/03/2026,חנות בגדים,120.00,60.00");
    expect(txns[0].amountAgorot).toBe(6000);
  });

  it("skips refunds and junk lines", () => {
    const txns = parseStatement(
      "01/03/2026,החזר ביטוח,-89.90\nsome random line\n,,,\n05/03/2026,פרטנר,49.90",
    );
    expect(txns).toHaveLength(1);
    expect(txns[0].merchant).toBe("פרטנר");
  });
});

describe("categorize", () => {
  it("maps Israeli merchants to categories", () => {
    expect(categorize("סלקום בע\"מ")).toBe("cellular");
    expect(categorize("הוט מובייל")).toBe("cellular");
    expect(categorize("HOT טלקום")).toBe("tv_internet");
    expect(categorize("נטפליקס")).toBe("tv_internet");
    expect(categorize("הראל חברה לביטוח")).toBe("insurance");
    expect(categorize("הולמס פלייס")).toBe("fitness");
    expect(categorize("Spotify AB")).toBe("digital");
    expect(categorize("סופר יוחננוף")).toBe("other");
  });
});

describe("detectRecurring", () => {
  it("finds monthly charges and estimates the monthly amount", () => {
    const rec = detectRecurring(parseStatement(CSV_HE));
    const merchants = rec.map((r) => r.merchant);
    expect(merchants.some((m) => m.includes("סלקום"))).toBe(true);
    expect(merchants.some((m) => m.includes("נטפליקס"))).toBe(true);
    // One-off groceries and coffee are NOT recurring.
    expect(merchants.some((m) => m.includes("יוחננוף"))).toBe(false);
    expect(merchants.some((m) => m.includes("גרג"))).toBe(false);

    const cellcom = rec.find((r) => r.merchant.includes("סלקום"))!;
    expect(cellcom.monthlyAgorot).toBe(8990);
    expect(cellcom.occurrences).toBe(3);
    expect(cellcom.category).toBe("cellular");
    expect(cellcom.providerKey).toBe("cellcom"); // actionable → check CTA
  });

  it("does not flag same-amount charges months apart as monthly", () => {
    const rec = detectRecurring(
      parseStatement("01/01/2026,חנות ספרים,50.00\n01/06/2026,חנות ספרים,50.00"),
    );
    expect(rec).toHaveLength(0);
  });

  it("totals the monthly recurring spend", () => {
    const res = scanStatement(CSV_HE);
    expect(res.transactions).toBe(7);
    expect(res.totalMonthlyAgorot).toBe(8990 + 5490);
  });
});

describe("recurringConfidence", () => {
  it("cannot reach the speaking threshold on two sightings, however tidy", () => {
    // Two identical charges exactly a month apart is the textbook false
    // positive: a fortnightly shop, two visits to the same restaurant. The
    // detector may still list it; the claim gate must not announce it.
    const c = recurringConfidence([4990, 4990], [30]);
    expect(c).toBeLessThan(CLAIM_SPEAK_THRESHOLD);
  });

  it("clears the threshold once the pattern is actually a pattern", () => {
    const c = recurringConfidence([4990, 4990, 4990, 4990], [30, 31, 29]);
    expect(c).toBeGreaterThanOrEqual(CLAIM_SPEAK_THRESHOLD);
  });

  it("penalises amounts that wander", () => {
    const steady = recurringConfidence([4990, 4990, 4990], [30, 30]);
    const wandering = recurringConfidence([1200, 4990, 9400], [30, 30]);
    expect(wandering).toBeLessThan(steady);
  });

  it("penalises a cadence that is not monthly", () => {
    const monthly = recurringConfidence([4990, 4990, 4990], [30, 30]);
    const scattered = recurringConfidence([4990, 4990, 4990], [3, 120]);
    expect(scattered).toBeLessThan(monthly);
  });

  it("returns 0 rather than guessing on a single charge", () => {
    expect(recurringConfidence([4990], [])).toBe(0);
  });

  it("stays inside 0..1 on hostile input", () => {
    for (const c of [
      recurringConfidence([0, 0, 0], [30, 30]),
      recurringConfidence([1, 1_000_000], [1]),
      recurringConfidence(new Array(50).fill(4990), new Array(49).fill(30)),
    ]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});
