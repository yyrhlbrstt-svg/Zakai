import { describe, expect, it, vi } from "vitest";
import { parseAmountToAgorot, merchantOf, type OpenBankingTransaction } from "./types";
import { MockOpenBankingProvider, MOCK_WINDOW } from "./mock";
import { estimateFromFeed, toStatementTxns } from "./estimate";
import { detectPriceIncreases } from "./priceIncrease";
import { selectProvider } from "./index";

const txn = (over: Partial<OpenBankingTransaction>): OpenBankingTransaction => ({
  transactionId: "t1",
  bookingDate: "2026-05-05",
  transactionAmount: { currency: "ILS", amount: "-10.00" },
  ...over,
});

describe("amount parsing — money never becomes a float", () => {
  it("parses the cases that break Number() * 100", () => {
    expect(parseAmountToAgorot("-89.90")).toBe(-8990);
    expect(parseAmountToAgorot("119.90")).toBe(11990);
    expect(parseAmountToAgorot("0.01")).toBe(1);
    expect(parseAmountToAgorot("1234.56")).toBe(123456);
  });

  it("handles missing and short fractions", () => {
    expect(parseAmountToAgorot("100")).toBe(10000);
    expect(parseAmountToAgorot("100.5")).toBe(10050);
    expect(parseAmountToAgorot("+7.00")).toBe(700);
  });

  it("truncates beyond two digits rather than rounding money up", () => {
    expect(parseAmountToAgorot("1.999")).toBe(199);
  });

  it("returns null, never zero, on anything it cannot read", () => {
    // Zero would understate what somebody is owed, which is the one direction
    // this codebase must never round.
    for (const bad of ["", "abc", "1,234.00", "₪89.90", "--1", "1.2.3", " "]) {
      expect(parseAmountToAgorot(bad)).toBeNull();
    }
  });

  it("always produces an integer", () => {
    for (const s of ["0.10", "3.33", "9999.99"]) {
      expect(Number.isInteger(parseAmountToAgorot(s))).toBe(true);
    }
  });
});

describe("merchant extraction falls through the fields a bank might populate", () => {
  it("prefers creditorName, then remittance, then debtor", () => {
    expect(merchantOf(txn({ creditorName: "נטפליקס", remittanceInformationUnstructured: "x" }))).toBe("נטפליקס");
    expect(merchantOf(txn({ remittanceInformationUnstructured: "פרטנר" }))).toBe("פרטנר");
    expect(merchantOf(txn({ debtorName: "משכורת" }))).toBe("משכורת");
    expect(merchantOf(txn({}))).toBe("");
  });
});

describe("the bridge into the detector", () => {
  it("drops money arriving — a salary is not a subscription", () => {
    const rows = toStatementTxns([
      txn({ creditorName: "משכורת", transactionAmount: { currency: "ILS", amount: "14200.00" } }),
      txn({ creditorName: "נטפליקס", transactionAmount: { currency: "ILS", amount: "-54.90" } }),
    ]);
    expect(rows.map((r) => r.merchant)).toEqual(["נטפליקס"]);
  });

  it("flips the sign, because the detector counts a charge as positive", () => {
    const [row] = toStatementTxns([txn({ creditorName: "x", transactionAmount: { currency: "ILS", amount: "-89.90" } })]);
    expect(row.amountAgorot).toBe(8990);
  });

  it("skips rows it cannot read rather than guessing", () => {
    expect(toStatementTxns([
      txn({ creditorName: "x", transactionAmount: { currency: "ILS", amount: "not a number" } }),
      txn({ creditorName: "", transactionAmount: { currency: "ILS", amount: "-5.00" } }),
      txn({ creditorName: "y", bookingDate: "not-a-date", transactionAmount: { currency: "ILS", amount: "-5.00" } }),
    ])).toEqual([]);
  });
});

describe("the mock provider", () => {
  const p = new MockOpenBankingProvider();

  it("declares itself not live, so no screen can render it as real", async () => {
    expect(p.isLive).toBe(false);
  });

  it("returns a checking account and a card, Berlin Group shaped", async () => {
    const accounts = await p.getAccounts("user-1");
    expect(accounts).toHaveLength(2);
    const checking = accounts.find((a) => a.cashAccountType === "CACC");
    const card = accounts.find((a) => a.cashAccountType === "CARD");
    expect(checking?.iban).toMatch(/^IL\d+/);
    expect(card?.maskedPan).toContain("4417");
    expect(card?.iban).toBeUndefined();
  });

  it("honours the date range", async () => {
    const all = await p.getTransactions("acc-card-002", MOCK_WINDOW);
    const june = await p.getTransactions("acc-card-002", { from: "2026-06-01", to: "2026-06-30" });
    expect(june.length).toBeGreaterThan(0);
    expect(june.length).toBeLessThan(all.length);
    expect(june.every((t) => t.bookingDate.startsWith("2026-06"))).toBe(true);
  });

  it("returns nothing for an unknown account rather than throwing", async () => {
    expect(await p.getTransactions("nope", MOCK_WINDOW)).toEqual([]);
    expect(await p.getBalance("nope")).toEqual([]);
  });
});

describe("the estimate over the fixture", () => {
  it("finds the plantable subscriptions and refuses the coincidence", async () => {
    const p = new MockOpenBankingProvider();
    const txns = [
      ...(await p.getTransactions("acc-card-002", MOCK_WINDOW)),
      ...(await p.getTransactions("acc-checking-001", MOCK_WINDOW)),
    ];
    const est = estimateFromFeed(txns, p.isLive);
    const claimed = est.claimable.map((c) => c.merchant).join(" ");

    // The forgotten subscription and the gym are real findings.
    expect(claimed).toContain("נטפליקס");
    expect(claimed).toContain("הולמס פלייס");
    // סלקום is deliberately NOT here. Its price steps up mid-window, which
    // the recurring detector reads as an unsteady amount and scores down —
    // the finding is real, but it is a different finding, and it is reported
    // as a price increase rather than smuggled in as a subscription.
    expect(claimed).not.toContain("סלקום");

    // Two restaurant visits a month apart is the textbook false positive.
    expect(claimed).not.toContain("מסעדת הגן");
    expect(est.heldBack.map((c) => c.merchant).join(" ")).toContain("מסעדת הגן");
  });

  it("does not read a bi-monthly electricity bill as a monthly subscription", async () => {
    const p = new MockOpenBankingProvider();
    const est = estimateFromFeed(await p.getTransactions("acc-checking-001", MOCK_WINDOW), p.isLive);
    expect(est.claimable.map((c) => c.merchant).join(" ")).not.toContain("חברת החשמל");
  });

  it("counts only claimable charges into the headline figure", async () => {
    const p = new MockOpenBankingProvider();
    const est = estimateFromFeed(await p.getTransactions("acc-card-002", MOCK_WINDOW), p.isLive);
    const expected = est.claimable.reduce((s, c) => s + c.monthlyAgorot, 0);
    expect(est.monthlyAgorot).toBe(expected);
    expect(Number.isInteger(est.monthlyAgorot)).toBe(true);
  });

  it("carries isLive onto the result so a component cannot forget", async () => {
    const p = new MockOpenBankingProvider();
    const est = estimateFromFeed(await p.getTransactions("acc-card-002", MOCK_WINDOW), p.isLive);
    expect(est.isLive).toBe(false);
  });
});

describe("provider selection never crashes the app", () => {
  const cfg = { baseUrl: "https://x", clientId: "a", clientSecret: "b" };

  it("defaults to mock when unset", () => {
    expect(selectProvider(undefined, null).provider.id).toBe("mock");
    expect(selectProvider("", null).fellBack).toBe(false);
  });

  it("falls back to mock — loudly — when finanda is asked for but unconfigured", () => {
    const r = selectProvider("finanda", null);
    expect(r.provider.id).toBe("mock");
    expect(r.fellBack).toBe(true);
    expect(r.requested).toBe("finanda");
  });

  it("uses finanda only when every credential is present", () => {
    const r = selectProvider("finanda", cfg);
    expect(r.provider.id).toBe("finanda");
    expect(r.fellBack).toBe(false);
    expect(r.provider.isLive).toBe(true);
  });

  it("treats an unknown provider name as mock rather than throwing", () => {
    expect(selectProvider("plaid", cfg).provider.id).toBe("mock");
  });

  it("is case- and whitespace-insensitive about the env value", () => {
    expect(selectProvider("  FINANDA ", cfg).provider.id).toBe("finanda");
  });
});

describe("the price step-up the recurring detector cannot see", () => {
  it("finds the סלקום rise the fixture plants", async () => {
    const p = new MockOpenBankingProvider();
    const est = estimateFromFeed(await p.getTransactions("acc-card-002", MOCK_WINDOW), p.isLive);
    const cellcom = est.priceIncreases.find((r) => r.merchant.includes("סלקום"));
    expect(cellcom).toBeDefined();
    expect(cellcom!.fromAgorot).toBe(8990);
    expect(cellcom!.toAgorot).toBe(11990);
    expect(cellcom!.deltaAgorot).toBe(3000);
  });

  it("treats a single sighting of the higher price as a fact, not a claim", () => {
    // One month at the new price could be one month with an extra charge on
    // it. The rise is reported; asserting a refund on it is not.
    const p = new MockOpenBankingProvider();
    return p.getTransactions("acc-card-002", MOCK_WINDOW).then((txns) => {
      const est = estimateFromFeed(txns, p.isLive);
      const cellcom = est.priceIncreases.find((r) => r.merchant.includes("סלקום"))!;
      expect(cellcom.observationsAtNewPrice).toBe(1);
      expect(cellcom.claimable).toBe(false);
    });
  });

  it("does not invent a rise where the price merely wobbles", () => {
    const at = (d: string, merchant: string, agorot: number) => ({
      date: new Date(`${d}T00:00:00Z`), merchant, amountAgorot: agorot,
    });
    // Groceries: no direction, just noise.
    expect(detectPriceIncreases([
      at("2026-04-09", "שופרסל", 41275),
      at("2026-05-11", "שופרסל", 38910),
      at("2026-06-08", "שופרסל", 40120),
    ])).toEqual([]);
  });

  it("ignores rises too small to be worth anyone's attention", () => {
    const at = (d: string, agorot: number) => ({
      date: new Date(`${d}T00:00:00Z`), merchant: "ספק", amountAgorot: agorot,
    });
    // ₪1 on ₪99 is under both the absolute and the proportional floor.
    expect(detectPriceIncreases([at("2026-04-01", 9900), at("2026-05-01", 9900), at("2026-06-01", 10000)])).toEqual([]);
  });

  it("gains confidence as the new price repeats", () => {
    const at = (d: string, agorot: number) => ({
      date: new Date(`${d}T00:00:00Z`), merchant: "ספק", amountAgorot: agorot,
    });
    const once = detectPriceIncreases([at("2026-03-01", 8990), at("2026-04-01", 8990), at("2026-05-01", 11990)]);
    const thrice = detectPriceIncreases([
      at("2026-01-01", 8990), at("2026-02-01", 8990),
      at("2026-03-01", 11990), at("2026-04-01", 11990), at("2026-05-01", 11990),
    ]);
    expect(once[0].confidence).toBeLessThan(thrice[0].confidence);
    expect(thrice[0].claimable).toBe(true);
  });
});
