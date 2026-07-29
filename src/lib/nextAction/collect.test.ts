import { describe, expect, it } from "vitest";
import { collectCandidates } from "./collect";
import { pickNext } from "./pick";
import type { RightsProfile } from "../rights";

const NOW = new Date("2026-07-29T00:00:00Z");

const EMPLOYEE: RightsProfile = {
  ageGroup: "25_44",
  employment: "employee",
  children: 0,
  childrenUnder6: 0,
  renting: false,
  lowIncome: false,
  newImmigrant: false,
  dischargedSoldier: false,
  reservist: false,
  disability: false,
};

describe("all five categories arrive in one comparable list", () => {
  it("brings entitlements, captive pricing and dormant money together", () => {
    const list = collectCandidates({
      profile: { ...EMPLOYEE, hasMortgage: true, pastEmployers: 3 },
      now: NOW,
    });
    const kinds = new Set(list.map((c) => c.kind));
    expect(kinds.has("deadline")).toBe(true);
    expect(kinds.has("recurring")).toBe(true);
    expect(kinds.has("disclosure")).toBe(true);
    expect(list.some((c) => c.id === "dormant")).toBe(true);
    expect(list.some((c) => c.id.startsWith("captive:"))).toBe(true);
  });

  it("never routes anybody outside the app", () => {
    const list = collectCandidates({
      profile: { ...EMPLOYEE, hasMortgage: true, pastEmployers: 2 },
      now: NOW,
    });
    for (const c of list) expect(c.href.startsWith("/")).toBe(true);
  });

  it("does not list the same right twice under two framings", () => {
    // A right that has a countdown must not also appear as a clockless entry,
    // or the person sees it twice with two different stories and trusts neither.
    const list = collectCandidates({ profile: EMPLOYEE, now: NOW });
    const bare = list.map((c) => c.id.split(":")[0]);
    const clocked = new Set(list.filter((c) => c.kind === "deadline").map((c) => c.id.split(":")[0]));
    const clockless = bare.filter((id, i) => list[i].kind === "one_off");
    for (const id of clockless) expect(clocked.has(id)).toBe(false);
  });

  it("omits what has already been acted on", () => {
    const all = collectCandidates({ profile: EMPLOYEE, now: NOW });
    const first = all.find((c) => c.kind === "one_off")!;
    const after = collectCandidates({ profile: EMPLOYEE, actedOn: [first.id], now: NOW });
    expect(after.some((c) => c.id === first.id && !c.done)).toBe(false);
  });

  it("adds nothing for a profile that unlocked nothing", () => {
    const list = collectCandidates({ profile: EMPLOYEE, now: NOW });
    expect(list.some((c) => c.id === "dormant")).toBe(false);
  });

  it("is deterministic", () => {
    const a = collectCandidates({ profile: { ...EMPLOYEE, pastEmployers: 2 }, now: NOW });
    const b = collectCandidates({ profile: { ...EMPLOYEE, pastEmployers: 2 }, now: NOW });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
});

describe("measured money outranks unmeasured money, deliberately", () => {
  it("prefers a right with a real figure over a category with none", () => {
    // Captive pricing and dormant accounts carry no value because no honest one
    // exists — the estimate needs a number only the person has. Rather than
    // invent a weight so they can compete, they rank last on pressure and reach
    // people through their own cards. Stating that here so the behaviour is a
    // decision rather than an accident of arithmetic.
    const list = collectCandidates({
      profile: { ...EMPLOYEE, hasMortgage: true, pastEmployers: 4 },
      now: NOW,
    });
    const next = pickNext(list)!;
    expect(next.candidate.valueMinor).toBeGreaterThan(0);
    expect(["dormant"]).not.toContain(next.candidate.id);
  });

  it("still surfaces an unmeasured category when nothing measured is open", () => {
    const unmeasured = collectCandidates({
      profile: { ...EMPLOYEE, hasMortgage: true, pastEmployers: 4 },
      now: NOW,
    }).filter((c) => c.valueMinor === 0);
    const next = pickNext(unmeasured)!;
    expect(next).not.toBeNull();
    expect(["disclosure", "recurring", "event"]).toContain(next.candidate.kind);
  });
});

describe("the whole pipeline answers with one thing", () => {
  it("returns a single action from a real profile", () => {
    const next = pickNext(
      collectCandidates({
        profile: { ...EMPLOYEE, children: 2, hasMortgage: true, pastEmployers: 5 },
        now: NOW,
      }),
    )!;
    expect(next.candidate).toBeDefined();
    expect(next.runnersUp.length).toBeLessThanOrEqual(4);
    expect(next.totalOpen).toBeGreaterThan(1);
  });
});
