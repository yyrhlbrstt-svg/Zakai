import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import {
  actionableFindings,
  addressableMonthlyAgorot,
  auditBusinessExpenses,
  classifyBusinessCharge,
} from "./businessExpenseAudit";
import type { RecurringCharge } from "./subscriptions";

const charge = (merchant: string, monthlyAgorot = 10_000): RecurringCharge => ({
  merchant,
  category: "other",
  monthlyAgorot,
  chargedOn: [],
  occurrences: 3,
  providerKey: null, confidence: 1,
});

describe("classifyBusinessCharge", () => {
  it("recognises acquirers and gateways", () => {
    for (const name of ["ישראכרט", "טרנזילה", "PayPlus", "Cardcom", "עמלת סליקה"]) {
      expect(classifyBusinessCharge(name), name).toBe("clearing");
    }
  });

  it("recognises business banking", () => {
    for (const name of ["בנק הפועלים", "עמלת ניהול חשבון", "Mizrahi"]) {
      expect(classifyBusinessCharge(name), name).toBe("bank_fee");
    }
  });

  it("recognises the software an SMB actually pays for", () => {
    for (const name of ["חשבשבת", "Green Invoice", "Google Workspace", "monday.com", "AWS"]) {
      expect(classifyBusinessCharge(name), name).toBe("software");
    }
  });

  it("recognises leasing, telecom, insurance and utilities", () => {
    expect(classifyBusinessCharge("ליסינג אלבר")).toBe("leasing");
    expect(classifyBusinessCharge("סלקום")).toBe("telecom");
    expect(classifyBusinessCharge("הפניקס ביטוח")).toBe("insurance");
    expect(classifyBusinessCharge("חברת החשמל")).toBe("utilities");
  });

  /**
   * The ordering guard. "ישראכרט" is both an acquirer and a card issuer, and
   * the bank pattern would swallow it — sending a shop owner to the consumer
   * bank-fee tool instead of the clearing-fee one.
   */
  it("reads an acquirer as clearing, not as a bank charge", () => {
    expect(classifyBusinessCharge("ישראכרט סליקה")).toBe("clearing");
    expect(classifyBusinessCharge("לאומי קארד")).toBe("clearing");
    // ...while the bank itself still reads as a bank charge.
    expect(classifyBusinessCharge("בנק לאומי")).toBe("bank_fee");
  });

  it("leaves anything it cannot place unclassified rather than guessing", () => {
    expect(classifyBusinessCharge("ספק כלשהו בע״מ")).toBe("unclassified");
    expect(classifyBusinessCharge("")).toBe("unclassified");
  });
});

describe("auditBusinessExpenses", () => {
  const findings = auditBusinessExpenses([
    charge("Google Workspace", 8_000),
    charge("ישראכרט סליקה", 60_000),
    charge("ספק מקומי בע״מ", 40_000),
    charge("בנק הפועלים", 12_000),
  ]);

  it("puts the biggest cost first", () => {
    expect(findings[0].charge.merchant).toBe("ישראכרט סליקה");
    const amounts = findings.map((f) => f.charge.monthlyAgorot);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it("routes each finding to a tool that exists", () => {
    for (const f of actionableFindings(findings)) {
      expect(existsSync(`src/app/[locale]${f.href}/page.tsx`), `${f.href} has no page`).toBe(true);
    }
  });

  it("offers no route for costs with no tool yet, rather than a dead end", () => {
    const leasing = auditBusinessExpenses([charge("ליסינג אלבר")])[0];
    expect(leasing.kind).toBe("leasing");
    expect(leasing.href).toBeNull();
  });

  it("counts only what it can act on, and never calls it a saving", () => {
    // 60,000 clearing + 12,000 bank + 8,000 software; the unclassified
    // 40,000 line is excluded because nothing can be done with it here.
    expect(addressableMonthlyAgorot(findings)).toBe(80_000);
  });

  it("handles an empty statement", () => {
    expect(auditBusinessExpenses([])).toEqual([]);
    expect(addressableMonthlyAgorot([])).toBe(0);
  });
});
