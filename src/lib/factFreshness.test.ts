import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import {
  DATED_FACTS,
  factAgeMonths,
  factsDueSoon,
  staleFacts,
} from "./factFreshness";

describe("dated-fact register", () => {
  it("every entry names a module that exists", () => {
    for (const fact of DATED_FACTS) {
      expect(existsSync(fact.module), `${fact.id} points at a missing ${fact.module}`).toBe(true);
    }
  });

  it("every entry has a well-formed date, a source and a leash", () => {
    for (const fact of DATED_FACTS) {
      expect(fact.verified, `${fact.id} verified date`).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      expect(fact.source.trim().length, `${fact.id} needs a source to re-check`).toBeGreaterThan(5);
      expect(fact.maxAgeMonths, `${fact.id} leash`).toBeGreaterThan(0);
    }
  });

  it("has no duplicate ids", () => {
    const ids = DATED_FACTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ages and classifies correctly", () => {
    const fact = DATED_FACTS.find((f) => f.id === "vat-rate")!;
    expect(factAgeMonths(fact, new Date("2026-07-15T00:00:00Z"))).toBe(0);
    expect(factAgeMonths(fact, new Date("2027-01-15T00:00:00Z"))).toBe(6);
    expect(staleFacts(new Date("2027-07-15T00:00:00Z")).some((f) => f.id === "vat-rate")).toBe(true);
  });

  it("sorts stale facts oldest first", () => {
    const far = new Date("2030-01-01T00:00:00Z");
    const ages = staleFacts(far).map((f) => factAgeMonths(f, far));
    expect(ages).toEqual([...ages].sort((a, b) => b - a));
  });

  it("does not report a fact as both due-soon and already stale", () => {
    const someday = new Date("2027-06-01T00:00:00Z");
    const stale = new Set(staleFacts(someday).map((f) => f.id));
    for (const due of factsDueSoon(2, someday)) {
      expect(stale.has(due.id), `${due.id} cannot be both due-soon and stale`).toBe(false);
    }
  });

  /**
   * The ratchet. When this fails, one of the figures Zakai puts in front of a
   * bank, a landlord or a tax office has gone longer than agreed without a
   * human confirming it still holds.
   *
   * Fix it by opening the named source and re-checking the value, then moving
   * the `verified` date in the same commit. Do NOT raise maxAgeMonths or drop
   * the entry to get green — that converts a known-unverified number into a
   * silently-wrong one, which is the whole thing this guards against.
   */
  it("no shipped fact is past its re-verification date", () => {
    const stale = staleFacts();
    expect(
      stale.map((f) => `${f.id} (${factAgeMonths(f)}mo, limit ${f.maxAgeMonths}) → ${f.source}`),
      "these figures need a human to re-verify them before they are quoted again",
    ).toEqual([]);
  });
});
