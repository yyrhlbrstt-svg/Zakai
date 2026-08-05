import { describe, expect, it } from "vitest";
import { normalizeVendor, findDuplicateReceipt, receiptsToCsv, type ReceiptLike } from "./receipts";

describe("normalizeVendor", () => {
  it("collapses legal suffixes and casing so the same vendor always matches", () => {
    expect(normalizeVendor("Cellcom Ltd")).toBe("cellcom");
    expect(normalizeVendor('סלקום בע"מ')).toBe("סלקום");
    expect(normalizeVendor("CELLCOM")).toBe("cellcom");
  });

  it("collapses punctuation/whitespace differences", () => {
    expect(normalizeVendor("Super-Pharm  Ltd.")).toBe(normalizeVendor("Super Pharm"));
  });
});

describe("findDuplicateReceipt", () => {
  const base: ReceiptLike = {
    id: "r1",
    vendor: "Cellcom Ltd",
    amountAgorot: 8990,
    occurredAt: new Date("2026-08-01T10:00:00Z"),
  };

  it("flags a same-vendor, same-amount charge within the detection window", () => {
    const candidate = {
      vendor: "CELLCOM",
      amountAgorot: 8990,
      occurredAt: new Date("2026-08-05T10:00:00Z"),
    };
    expect(findDuplicateReceipt(candidate, [base])?.id).toBe("r1");
  });

  it("does not flag a different amount", () => {
    const candidate = {
      vendor: "Cellcom",
      amountAgorot: 9990,
      occurredAt: new Date("2026-08-05T10:00:00Z"),
    };
    expect(findDuplicateReceipt(candidate, [base])).toBeNull();
  });

  it("does not flag a different vendor for the same amount", () => {
    const candidate = {
      vendor: "Partner",
      amountAgorot: 8990,
      occurredAt: new Date("2026-08-05T10:00:00Z"),
    };
    expect(findDuplicateReceipt(candidate, [base])).toBeNull();
  });

  it("does not flag two genuinely separate purchases outside the window", () => {
    const candidate = {
      vendor: "Cellcom",
      amountAgorot: 8990,
      occurredAt: new Date("2026-10-01T10:00:00Z"), // ~two months later
    };
    expect(findDuplicateReceipt(candidate, [base])).toBeNull();
  });

  it("ignores a zero/negative amount — nothing to claim a refund on", () => {
    const candidate = { vendor: "Cellcom", amountAgorot: 0, occurredAt: new Date() };
    expect(findDuplicateReceipt(candidate, [base])).toBeNull();
  });

  it("picks the closest match when multiple prior receipts qualify", () => {
    const far: ReceiptLike = { ...base, id: "far", occurredAt: new Date("2026-07-20T10:00:00Z") };
    const near: ReceiptLike = { ...base, id: "near", occurredAt: new Date("2026-08-04T10:00:00Z") };
    const candidate = {
      vendor: "Cellcom",
      amountAgorot: 8990,
      occurredAt: new Date("2026-08-05T10:00:00Z"),
    };
    expect(findDuplicateReceipt(candidate, [far, near])?.id).toBe("near");
  });
});

describe("receiptsToCsv", () => {
  it("renders a header row and one row per receipt", () => {
    const csv = receiptsToCsv([
      {
        vendor: "Cellcom",
        amountAgorot: 8990,
        currency: "ILS",
        occurredAt: new Date("2026-08-01T00:00:00Z"),
        category: "recurring",
        hasVat: true,
        flaggedAt: null,
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("vendor,amount,currency,date,category,vat,flagged_duplicate");
    expect(lines[1]).toBe("Cellcom,89.90,ILS,2026-08-01,recurring,yes,no");
  });

  it("quotes vendor names containing commas", () => {
    const csv = receiptsToCsv([
      {
        vendor: "Café, Ltd",
        amountAgorot: 1000,
        currency: "ILS",
        occurredAt: null,
        category: "personal",
        hasVat: false,
        flaggedAt: new Date(),
      },
    ]);
    expect(csv).toContain('"Café, Ltd"');
    expect(csv).toContain(",,personal,no,yes");
  });
});
