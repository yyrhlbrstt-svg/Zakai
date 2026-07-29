import { describe, expect, it } from "vitest";
import { IL_DORMANT, dormantById, type DormantFacts } from "./sources";
import { traceDormant, unaskedThatAdd } from "./trace";
import { buildDormantLetter } from "./letters";

const SIX_JOBS: DormantFacts = { pastEmployers: 6 };

describe("the employer count does the heavy lifting", () => {
  it("expands one tap into one institution per era", () => {
    // Nobody can name the fund their second employer opened in 2014. Everybody
    // can say how many jobs they have had.
    const r = traceDormant(SIX_JOBS);
    const provident = r.leads.filter((l) => l.source.id === "old_provident_funds");
    expect(provident).toHaveLength(6);
    expect(provident.map((l) => l.employerIndex)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("does not expand the sources that are not per-employer", () => {
    const r = traceDormant({ ...SIX_JOBS, changedBank: true });
    expect(r.leads.filter((l) => l.source.id === "dormant_bank_account")).toHaveLength(1);
  });

  it("returns nothing from nothing rather than inventing a lead", () => {
    expect(traceDormant({}).leads).toEqual([]);
    expect(traceDormant({}).institutionCount).toBe(0);
  });

  it("caps the expansion so a mistyped answer cannot produce a hundred letters", () => {
    const r = traceDormant({ pastEmployers: 500 });
    expect(r.leads.filter((l) => l.source.id === "old_pension").length).toBeLessThanOrEqual(8);
  });

  it("ignores a nonsensical count instead of failing", () => {
    expect(traceDormant({ pastEmployers: -3 }).leads).toEqual([]);
    expect(traceDormant({ pastEmployers: 2.7 }).leads.filter((l) => l.employerIndex).length)
      .toBeGreaterThan(0);
  });
});

describe("the headline is a count of duties, not a sum of money", () => {
  it("counts institutions, and never states an amount anywhere", () => {
    // A dormant account is nine shekels or ninety thousand and the distribution
    // is visible only to whoever is holding it. Inventing a figure to make the
    // screen exciting is the purest form of the fabrication this product exists
    // to avoid.
    const r = traceDormant({ pastEmployers: 3, changedBank: true, heldSecurities: true });
    expect(r.institutionCount).toBeGreaterThan(3);
    for (const s of IL_DORMANT) {
      expect(s.whyYou).not.toMatch(/₪|\d{3,}/);
      expect(s.duty).not.toMatch(/₪/);
    }
  });

  it("does not double-count two products held at the same institution", () => {
    // Six jobs produce a provident letter and a pension letter each, plus a
    // study fund and an insurer. That is fourteen letters — but one employer's
    // provident fund and pension are frequently run by the same house, so the
    // honest count is six bodies plus the two standalone ones.
    const r = traceDormant(SIX_JOBS);
    expect(r.leads.length).toBe(14);
    expect(r.institutionCount).toBe(8);
    expect(r.institutionCount).toBeLessThan(r.leads.length);
  });

  it("counts a standalone source once however many letters it produces", () => {
    const r = traceDormant({ changedBank: true, heldSecurities: true, unreturnedDeposit: true });
    expect(r.institutionCount).toBe(3);
  });
});

describe("an heir is not in the same situation as an account-holder", () => {
  it("routes a bereavement to the heir sources only", () => {
    const r = traceDormant({ deceasedRelative: true });
    expect(r.heirLeads.length).toBeGreaterThan(0);
    for (const l of r.heirLeads) expect(l.source.claimant).not.toBe("self");
  });

  it("never offers a self-only source as an heir claim", () => {
    // Putting a bereaved family in front of the wrong letter is the failure
    // mode that matters here.
    const r = traceDormant({ deceasedRelative: true, pastEmployers: 2, hadStudyFund: true });
    for (const l of r.leads) {
      if (l.source.claimant === "self") expect(l.as).toBe("self");
      if (l.source.claimant === "heir") expect(l.as).toBe("heir");
    }
  });

  it("asks for probate documents on every heir source and on no self-only source", () => {
    for (const s of IL_DORMANT) {
      const needsProbate = s.needs.some((n) => n.includes("צו ירושה"));
      if (s.claimant === "heir") expect(needsProbate).toBe(true);
      if (s.claimant === "self") expect(needsProbate).toBe(false);
    }
  });
});

describe("the catalogue keeps its promises", () => {
  it("cites the duty that makes a letter work, for every source", () => {
    // Without a duty this is a polite request an institution may ignore.
    for (const s of IL_DORMANT) expect(s.duty.trim().length).toBeGreaterThan(15);
  });

  it("explains why this person plausibly has something there", () => {
    for (const s of IL_DORMANT) expect(s.whyYou.trim().length).toBeGreaterThan(20);
  });

  it("keeps the prerequisites short", () => {
    for (const s of IL_DORMANT) {
      expect(s.needs.length).toBeGreaterThan(0);
      expect(s.needs.length).toBeLessThanOrEqual(3);
    }
  });

  it("has no duplicate ids and resolves each one", () => {
    const ids = IL_DORMANT.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of IL_DORMANT) expect(dormantById(s.id)).toBe(s);
    expect(dormantById("nope")).toBeUndefined();
  });

  it("is deterministic — identical facts, identical list", () => {
    const a = traceDormant(SIX_JOBS).leads.map((l) => `${l.source.id}:${l.employerIndex}`);
    const b = traceDormant({ pastEmployers: 6 }).leads.map(
      (l) => `${l.source.id}:${l.employerIndex}`,
    );
    expect(a).toEqual(b);
  });
});

describe("the letter demands an answer, including the answer 'nothing'", () => {
  const lead = traceDormant(SIX_JOBS).leads[0];
  const heirLead = traceDormant({ deceasedRelative: true }).heirLeads[0];

  it("asks for an explicit negative reply", () => {
    // The reply people never get, because they never ask in writing.
    expect(buildDormantLetter(lead).body).toContain("גם אם לא נמצא דבר");
    expect(buildDormantLetter(heirLead).body).toContain("גם אם לא נמצא דבר");
  });

  it("asks which records were actually searched", () => {
    // Otherwise "we found nothing" is unfalsifiable.
    expect(buildDormantLetter(lead).body).toContain("פירוט המאגרים");
  });

  it("asks for the fees taken while the account sat quiet", () => {
    // The account was not merely forgotten — it was very often being charged.
    expect(buildDormantLetter(lead).body).toContain("דמי הניהול והעמלות שנגבו");
    expect(buildDormantLetter(heirLead).body).toContain("דמי הניהול שנגבו מאז הפטירה");
  });

  it("asserts nothing about what is being held", () => {
    for (const l of traceDormant({ pastEmployers: 2, deceasedRelative: true, changedBank: true }).leads) {
      const body = buildDormantLetter(l).body;
      expect(body).not.toMatch(/ידוע לי כי אתם מחזיקים|אתם מחזיקים בכספי/);
      expect(body).toContain("לבדוק ברישומיכם");
    }
  });

  it("gives the heir letter its own basis and paperwork", () => {
    const l = buildDormantLetter(heirLead);
    expect(l.as).toBe("heir");
    expect(l.body).toContain("תעודת פטירה");
    expect(l.body).toContain("צו ירושה");
    expect(l.subject).toContain("בקשת יורש");
  });

  it("cites the duty of the source it was built from", () => {
    for (const l of traceDormant({ pastEmployers: 1, deceasedRelative: true, preWarFamily: true, workedAbroad: true }).leads) {
      expect(buildDormantLetter(l).body).toContain(l.source.duty);
    }
  });

  it("asks them to correct the stale address that caused this", () => {
    // Returned post is the single most common way an account goes quiet, so a
    // letter that does not fix the address invites the same silence again.
    expect(buildDormantLetter(lead).body).toContain("כתובת ישנה");
  });

  it("leaves visible blanks rather than reading fine without the details", () => {
    const body = buildDormantLetter(lead).body;
    expect(body).toContain("[שם מלא]");
    expect(body).toContain("[מספר זהות]");
    expect(buildDormantLetter(heirLead).body).toContain("[שם הנפטר/ת]");
  });

  it("uses what it was given", () => {
    const l = buildDormantLetter(lead, {
      name: "רות אברהם",
      id: "012345678",
      counterparty: "מנורה מבטחים",
      employer: "סייבר בע״מ",
      period: "2013–2016",
    });
    expect(l.body).toContain("רות אברהם");
    expect(l.body).toContain("מנורה מבטחים");
    expect(l.body).toContain("סייבר בע״מ");
    expect(l.body).toContain("2013–2016");
    expect(l.body).not.toContain("[שם מלא]");
  });

  it("sends nobody to another website", () => {
    // The thesis of this module is that the letter beats the search. A link
    // would contradict the entire premise.
    for (const l of traceDormant({ pastEmployers: 2, deceasedRelative: true, preWarFamily: true }).leads) {
      expect(buildDormantLetter(l).body).not.toMatch(/https?:\/\//);
    }
  });
});

describe("the questions come after the result", () => {
  it("names what has not been asked yet", () => {
    const gaps = unaskedThatAdd({ pastEmployers: 2 });
    expect(gaps).toContain("deceasedRelative");
    expect(gaps).not.toContain("pastEmployers");
  });

  it("stops asking once everything is answered", () => {
    expect(
      unaskedThatAdd({
        pastEmployers: 1,
        deceasedRelative: false,
        changedBank: false,
        hadStudyFund: false,
        movedHome: false,
        heldSecurities: false,
        unreturnedDeposit: false,
        workedAbroad: false,
        preWarFamily: false,
      }),
    ).toEqual([]);
  });

  it("treats an explicit no as answered, not as missing", () => {
    // Otherwise the product keeps asking a question somebody already declined.
    expect(unaskedThatAdd({ deceasedRelative: false })).not.toContain("deceasedRelative");
  });
});
