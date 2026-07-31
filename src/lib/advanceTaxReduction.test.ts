import { describe, it, expect } from "vitest";
import {
  ADVANCE_TAX_FORM_URL,
  advanceTaxReductionDeadline,
  daysUntilAdvanceTaxDeadline,
  canStillFileForYear,
  buildAdvanceTaxReductionLetter,
} from "./advanceTaxReduction";

describe("advanceTaxReductionDeadline", () => {
  it("is January 31 of the year after the tax year", () => {
    const d = advanceTaxReductionDeadline(2026);
    expect(d.getUTCFullYear()).toBe(2027);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(31);
  });
});

describe("daysUntilAdvanceTaxDeadline / canStillFileForYear", () => {
  it("is positive well before the deadline", () => {
    const now = new Date(Date.UTC(2026, 6, 31));
    expect(daysUntilAdvanceTaxDeadline(2026, now)).toBeGreaterThan(180);
    expect(canStillFileForYear(2026, now)).toBe(true);
  });

  it("is zero on the deadline day itself and still fileable", () => {
    const now = new Date(Date.UTC(2027, 0, 31));
    expect(daysUntilAdvanceTaxDeadline(2026, now)).toBe(0);
    expect(canStillFileForYear(2026, now)).toBe(true);
  });

  it("is negative and unfileable once the window has closed", () => {
    const now = new Date(Date.UTC(2027, 1, 1));
    expect(daysUntilAdvanceTaxDeadline(2026, now)).toBeLessThan(0);
    expect(canStillFileForYear(2026, now)).toBe(false);
  });
});

describe("buildAdvanceTaxReductionLetter", () => {
  const base = {
    name: "דנה כהן",
    taxFileNumber: "012345678",
    taxYear: 2026,
    reason: "ההכנסות ירדו משמעותית לעומת השנה שעליה מבוסס שיעור המקדמות.",
  };

  it("includes the taxpayer's identifying details and reason", () => {
    const letter = buildAdvanceTaxReductionLetter(base);
    expect(letter).toContain(base.name);
    expect(letter).toContain(base.taxFileNumber);
    expect(letter).toContain(String(base.taxYear));
    expect(letter).toContain(base.reason);
  });

  it("references form 2216א and the assessing office, never a specific rate", () => {
    const letter = buildAdvanceTaxReductionLetter(base);
    expect(letter).toContain("2216א");
    expect(letter).toContain("פקיד השומה");
    expect(letter).not.toMatch(/\d+%/);
  });

  it("carries the standard letter footer", () => {
    const letter = buildAdvanceTaxReductionLetter(base);
    expect(letter).toContain("זכאי");
  });
});

describe("ADVANCE_TAX_FORM_URL", () => {
  it("points at the real gov.il service page", () => {
    expect(ADVANCE_TAX_FORM_URL).toBe("https://www.gov.il/he/service/itc-2216a");
  });
});
