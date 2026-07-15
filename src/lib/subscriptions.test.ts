import { describe, it, expect } from "vitest";
import { parseStatement, detectRecurring, categorize, scanStatement } from "./subscriptions";

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
