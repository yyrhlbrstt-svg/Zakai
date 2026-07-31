/**
 * The inputs nobody meant to send.
 *
 * Every bug this file found was already masked by a guard in the one component
 * that happened to call the function — a `monthlyMinor > 0` check, a regex on a
 * date string, a component that only ever passes DEFAULT_PROFILE. That is not
 * safety, it is luck with a short shelf life: the moment a second caller
 * appears, or an API route forwards a client payload, the guard is somewhere
 * else and the library is the same as it always was.
 *
 * So these assert the libraries themselves survive, independent of who calls
 * them.
 */

import { describe, it, expect } from "vitest";
import { collectCandidates } from "./nextAction/collect";
import { pickNext, rankAll } from "./nextAction/pick";
import { traceDormant } from "./dormant/trace";
import { matchCovers } from "./incident/match";
import { estimateCaptive, captiveFor, IL_CAPTIVE } from "./captive/products";
import { summariseWatch } from "./vigil/watch";
import type { RightsProfile } from "./rights";

const HOSTILE: unknown[] = [
  {}, null, undefined,
  { ageGroup: "??", employment: "??", children: -5, childrenUnder6: 99 },
  { ageGroup: "25_44", employment: "employee", children: NaN, childrenUnder6: NaN },
  { ageGroup: "25_44", employment: "employee", children: Infinity, childrenUnder6: 0 },
  { ageGroup: "25_44", employment: "employee", children: 0, childrenUnder6: 0, pastEmployers: NaN },
  { ageGroup: "25_44", employment: "employee", children: 0, childrenUnder6: 0, pastEmployers: 1e9 },
];

describe("hostile profiles must not crash a screen somebody is reading", () => {
  for (const [i, p] of HOSTILE.entries()) {
    it(`survives hostile profile ${i}`, () => {
      const profile = p as RightsProfile;
      expect(() => {
        const c = collectCandidates({ profile });
        pickNext(c);
        rankAll(c);
        traceDormant({ pastEmployers: profile?.pastEmployers });
        summariseWatch({ profile, eligible: [] });
        captiveFor({ employed: true });
      }).not.toThrow();
    });
  }
});

describe("hostile numbers in the captive estimate", () => {
  for (const bad of [NaN, Infinity, -Infinity, 1e15, 0.5, -0]) {
    it(`survives monthly=${bad}`, () => {
      for (const p of IL_CAPTIVE) {
        const e = estimateCaptive(p, bad as number, 12);
        expect(Number.isFinite(e.annualSavingRangeMinor[0])).toBe(true);
        expect(Number.isFinite(e.annualSavingRangeMinor[1])).toBe(true);
        expect(e.annualSavingRangeMinor[0]).toBeGreaterThanOrEqual(0);
      }
    });
  }

  for (const months of [NaN, -1, Infinity, 1e9]) {
    it(`survives remainingMonths=${months}`, () => {
      const e = estimateCaptive(IL_CAPTIVE[0], 10_000, months as number);
      if (e.lifetimeSavingRangeMinor) {
        for (const v of e.lifetimeSavingRangeMinor) expect(Number.isFinite(v)).toBe(true);
      }
    });
  }
});

describe("hostile dates in the incident matcher", () => {
  for (const d of [new Date("nope"), new Date(0), new Date(8.64e15)]) {
    it(`survives occurredAt=${d.toString().slice(0, 24)}`, () => {
      expect(() => matchCovers({ kind: "sport", occurredAt: d })).not.toThrow();
      const r = matchCovers({ kind: "sport", occurredAt: d });
      for (const m of r.matches) {
        if (m.daysLeft !== null) expect(Number.isFinite(m.daysLeft)).toBe(true);
      }
    });
  }
});
