import { describe, expect, it } from "vitest";
import { IL_COVER_SOURCES, sourceById, type IncidentFacts } from "./sources";
import { matchCovers, unansweredThatMatter } from "./match";
import { buildIncidentLetter } from "./letters";

const NOW = new Date("2026-07-29T00:00:00Z");
const LAST_MONTH = new Date("2026-06-20T00:00:00Z");

/** The case the whole module was built for. */
const TORN_ACL: IncidentFacts = {
  kind: "sport",
  occurredAt: LAST_MONTH,
  employed: true,
  hasPension: true,
  registeredAthlete: true,
  lostWorkDays: true,
  neededTreatment: true,
};

describe("a torn cruciate ligament reaches more than one payer", () => {
  it("finds the payers a person would never think to name", () => {
    // The failure this exists to prevent: claiming from the HMO for the
    // surgery, believing that is the claim, and never touching the four
    // compensation payers that would each have paid separately.
    const ids = matchCovers(TORN_ACL, NOW).matches.map((m) => m.source.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "sports_insurance",
        "pension_disability",
        "personal_accident_policy",
        "supplementary_health",
        "ni_general_disability",
      ]),
    );
    expect(ids.length).toBeGreaterThanOrEqual(5);
  });

  it("says how many can be claimed in parallel", () => {
    const r = matchCovers(TORN_ACL, NOW);
    expect(r.stackableCount).toBeGreaterThanOrEqual(4);
    expect(r.indemnityCount).toBeGreaterThanOrEqual(1);
  });

  it("does not mark the reimbursement sources as stacking", () => {
    // Two indemnity policies pay the surgery once between them. Telling
    // somebody otherwise sets up a rejection they will read as our error.
    const r = matchCovers(TORN_ACL, NOW);
    for (const m of r.matches) {
      expect(m.stacks).toBe(m.source.kind === "compensation");
    }
  });
});

describe("the commute is the one nobody knows about", () => {
  it("treats an accident on the way to work as a work accident", () => {
    const ids = matchCovers({ kind: "commute", occurredAt: LAST_MONTH }, NOW).matches.map(
      (m) => m.source.id,
    );
    expect(ids).toContain("ni_work_injury");
  });

  it("does not reach work-injury cover for a weekend fall at home", () => {
    const ids = matchCovers({ kind: "home", occurredAt: LAST_MONTH }, NOW).matches.map(
      (m) => m.source.id,
    );
    expect(ids).not.toContain("ni_work_injury");
  });
});

describe("the school cover is statutory, universal and unclaimed", () => {
  it("applies to a minor regardless of where or when it happened", () => {
    for (const kind of ["home", "sport", "school", "road"] as const) {
      const ids = matchCovers({ kind, minor: true, occurredAt: LAST_MONTH }, NOW).matches.map(
        (m) => m.source.id,
      );
      expect(ids).toContain("school_accident");
    }
  });

  it("does not offer it to an adult", () => {
    const ids = matchCovers({ kind: "sport", minor: false, occurredAt: LAST_MONTH }, NOW).matches.map(
      (m) => m.source.id,
    );
    expect(ids).not.toContain("school_accident");
  });
});

describe("road cover does not depend on whose fault it was", () => {
  it("applies whenever a vehicle was involved at all", () => {
    const ids = matchCovers({ kind: "home", vehicleInvolved: true, occurredAt: LAST_MONTH }, NOW)
      .matches.map((m) => m.source.id);
    expect(ids).toContain("pltd_road");
  });

  it("never conditions the road source on fault, because the statute does not", () => {
    const src = sourceById("pltd_road")!;
    expect(src.basis).toContain("ללא הוכחת אשם");
  });
});

describe("ordering is by what expires first, not by what pays most", () => {
  it("puts the twelve-month window ahead of the seven-year one", () => {
    // Sorting by expected size would front the road claim, which survives until
    // 2033, and let the work-injury claim die in month thirteen.
    const r = matchCovers(
      { kind: "commute", occurredAt: LAST_MONTH, vehicleInvolved: true, employed: true },
      NOW,
    );
    expect(r.matches[0].source.id).toBe("ni_work_injury");
    expect(r.nextDeadline?.source.id).toBe("ni_work_injury");
  });

  it("counts down against the real date", () => {
    const r = matchCovers({ kind: "work", employed: true, occurredAt: LAST_MONTH }, NOW);
    const ni = r.matches.find((m) => m.source.id === "ni_work_injury")!;
    expect(ni.closesAt!.toISOString().slice(0, 10)).toBe("2027-06-20");
    expect(ni.daysLeft).toBeGreaterThan(300);
    expect(ni.urgency).toBe("ample");
  });

  it("shows a window with no countdown when no date was given", () => {
    // A deadline we cannot place on a calendar must not be drawn as one.
    const r = matchCovers({ kind: "work", employed: true }, NOW);
    for (const m of r.matches) {
      expect(m.daysLeft).toBeNull();
      expect(m.closesAt).toBeNull();
      expect(m.urgency).toBe("unknown");
    }
    expect(r.nextDeadline).toBeNull();
  });

  it("reports what has already run out instead of hiding it", () => {
    // The person is entitled to know, and to argue about when the clock started.
    const old = new Date("2024-01-01T00:00:00Z");
    const r = matchCovers({ kind: "work", employed: true, occurredAt: old }, NOW);
    const ni = r.matches.find((m) => m.source.id === "ni_work_injury")!;
    expect(ni.urgency).toBe("expired");
    expect(r.matches[r.matches.length - 1].urgency).toBe("expired");
    // An expired window is reported but never counted as still claimable.
    expect(r.stackableCount).toBe(r.matches.filter((m) => m.stacks && m.urgency !== "expired").length);
  });

  it("is a total order — identical input, identical output", () => {
    const a = matchCovers(TORN_ACL, NOW).matches.map((m) => m.source.id);
    const b = matchCovers({ ...TORN_ACL }, NOW).matches.map((m) => m.source.id);
    expect(a).toEqual(b);
  });
});

describe("the catalogue keeps its promises", () => {
  it("cites a statute for every payer", () => {
    for (const s of IL_COVER_SOURCES) expect(s.statute.trim().length).toBeGreaterThan(12);
  });

  it("states a basis of payment and never an amount", () => {
    // Every sum here depends on a disability percentage no doctor has set yet.
    // A confident shekel figure would be the most damaging number we print.
    for (const s of IL_COVER_SOURCES) {
      expect(s.basis.trim().length).toBeGreaterThan(12);
      expect(s.basis).not.toMatch(/₪/);
    }
  });

  it("says who typically holds it, rather than asserting the person does", () => {
    for (const s of IL_COVER_SOURCES) expect(s.whoHasIt.trim().length).toBeGreaterThan(12);
  });

  it("keeps the list of prerequisites short", () => {
    for (const s of IL_COVER_SOURCES) {
      expect(s.needs.length).toBeGreaterThan(0);
      expect(s.needs.length).toBeLessThanOrEqual(3);
    }
  });

  it("has no duplicate ids", () => {
    const ids = IL_COVER_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the questions come after the answer, not before it", () => {
  it("names the facts that would add a payer", () => {
    const gaps = unansweredThatMatter({ kind: "sport" });
    expect(gaps).toContain("vehicleInvolved");
    expect(gaps).toContain("registeredAthlete");
    expect(gaps).toContain("occurredAt");
  });

  it("stops asking about what it already knows", () => {
    expect(unansweredThatMatter({ kind: "road", occurredAt: NOW, minor: false, employed: true, hasPension: true }))
      .toEqual([]);
  });

  it("still returns payers with almost nothing supplied", () => {
    // A blank form must not be a blank result — that is the wall this removes.
    expect(matchCovers({ kind: "sport" }, NOW).matches.length).toBeGreaterThan(0);
  });
});

describe("the letter notifies; it does not claim", () => {
  const src = sourceById("ni_work_injury")!;

  it("never says a claim was filed", () => {
    const body = buildIncidentLetter(src).body;
    expect(body).not.toMatch(/הגשתי תביעה|תביעה הוגשה|הוגשה בשמך/);
    expect(body).toContain("פתיחת תיק");
  });

  it("asks the payer to disclose the cover rather than assuming it", () => {
    expect(buildIncidentLetter(src).body).toContain("פירוט מלא בכתב של הכיסויים");
  });

  it("asks the payer for their own view of the deadline", () => {
    // Ours is a statutory reading; theirs is the one they will act on, and the
    // gap between the two is worth knowing about early.
    expect(buildIncidentLetter(src).body).toContain("המועד האחרון להגשת תביעה");
  });

  it("reserves rights against everyone else", () => {
    // Without this line, notifying one payer reads as settling with them.
    expect(buildIncidentLetter(src).body).toContain("למצות זכויות כלפי גורמים נוספים");
  });

  it("cites the statute of the payer it is addressed to", () => {
    for (const s of IL_COVER_SOURCES) {
      expect(buildIncidentLetter(s).body).toContain(s.statute);
    }
  });

  it("addresses each payer correctly and leaves visible blanks", () => {
    const body = buildIncidentLetter(src).body;
    expect(body).toContain("המוסד לביטוח לאומי");
    expect(body).toContain("[שם מלא]");
    expect(body).toContain("[תאריך האירוע]");
  });

  it("uses what it was given", () => {
    const l = buildIncidentLetter(sourceById("sports_insurance")!, {
      name: "יואב לוי",
      id: "012345678",
      counterparty: "מועדון הפועל",
      occurredAt: new Date("2026-06-20T00:00:00Z"),
      what: "קרע ברצועה הצולבת במהלך משחק ליגה",
    });
    expect(l.body).toContain("יואב לוי");
    expect(l.body).toContain("מועדון הפועל");
    expect(l.body).toContain("20.6.2026");
    expect(l.body).toContain("קרע ברצועה הצולבת");
    expect(l.subject).toContain("20.6.2026");
  });

  it("sends nobody to another website", () => {
    for (const s of IL_COVER_SOURCES) {
      expect(buildIncidentLetter(s).body).not.toMatch(/https?:\/\//);
    }
  });
});
