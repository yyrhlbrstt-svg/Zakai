import { describe, it, expect } from "vitest";
import { analyzeSpending, categorizeSpend } from "./spending";

describe("categorizeSpend", () => {
  it("maps everyday merchants to the right buckets", () => {
    expect(categorizeSpend("שופרסל דיל")).toBe("groceries");
    expect(categorizeSpend("WOLT TEL AVIV")).toBe("dining");
    expect(categorizeSpend("פז יעד")).toBe("transport");
    expect(categorizeSpend("ZARA")).toBe("shopping");
    expect(categorizeSpend("סופר פארם")).toBe("health");
    expect(categorizeSpend("עיריית תל אביב ארנונה")).toBe("housing");
    expect(categorizeSpend("משיכת מזומן כספומט")).toBe("cash");
  });

  it("folds recurring bills and subscriptions in from the recurring categoriser", () => {
    expect(categorizeSpend("סלקום")).toBe("bills"); // cellular
    expect(categorizeSpend("חברת החשמל")).toBe("bills"); // electricity
    expect(categorizeSpend("הפניקס ביטוח")).toBe("bills"); // insurance
    expect(categorizeSpend("NETFLIX.COM")).toBe("bills"); // tv_internet → bills
    expect(categorizeSpend("SPOTIFY P0FEE")).toBe("entertainment"); // digital
  });

  it("falls back to 'other' for the unknown", () => {
    expect(categorizeSpend("מוסך הבורג הזהב")).toBe("other");
  });
});

describe("analyzeSpending", () => {
  const statement = [
    "01/03/2025,שופרסל דיל,450.00",
    "03/03/2025,WOLT,89.90",
    "05/03/2025,פז יעד דלק,300.00",
    "07/03/2025,סלקום,120.00",
    "09/03/2025,שופרסל דיל,210.50",
    "12/03/2025,NETFLIX.COM,54.90",
  ].join("\n");

  it("totals every transaction and splits by category with shares summing to 1", () => {
    const s = analyzeSpending(statement);
    expect(s.transactions).toBe(6);
    // 450 + 89.90 + 300 + 120 + 210.50 + 54.90 = 1225.30 → 122530 agorot
    expect(s.totalAgorot).toBe(122530);
    const shareSum = s.byCategory.reduce((acc, c) => acc + c.share, 0);
    expect(shareSum).toBeCloseTo(1, 6);
  });

  it("groceries is the largest category (two Shufersal charges), sorted first", () => {
    const s = analyzeSpending(statement);
    expect(s.byCategory[0].category).toBe("groceries");
    expect(s.byCategory[0].totalAgorot).toBe(66050); // 450 + 210.50
    expect(s.byCategory[0].count).toBe(2);
  });

  it("aggregates the same merchant across rows in topMerchants", () => {
    const s = analyzeSpending(statement);
    const shufersal = s.topMerchants.find((m) => /שופרסל/.test(m.merchant));
    expect(shufersal?.totalAgorot).toBe(66050);
    expect(shufersal?.count).toBe(2);
    // Sorted by spend, biggest first.
    expect(s.topMerchants[0].totalAgorot).toBe(66050);
  });

  it("empty input yields a zeroed summary, not a crash", () => {
    const s = analyzeSpending("");
    expect(s).toEqual({ transactions: 0, totalAgorot: 0, byCategory: [], topMerchants: [] });
  });
});
