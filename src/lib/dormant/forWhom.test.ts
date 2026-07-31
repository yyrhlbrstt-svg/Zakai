import { describe, expect, it } from "vitest";
import { SUBJECTS, needsProbate, signsOwnLetters, subjectProfile } from "./forWhom";
import { traceDormant } from "./trace";

describe("a living relative signs their own letters", () => {
  it("never lets the holder of the phone sign for a living person", () => {
    // We are not acting for them, they have authorised nothing, and a demand
    // arriving over a parent's name without their knowledge is forgery however
    // kindly meant.
    expect(signsOwnLetters("parent")).toBe(false);
    expect(signsOwnLetters("grandparent")).toBe(false);
  });

  it("lets a person sign for themselves", () => {
    expect(signsOwnLetters("self")).toBe(true);
  });

  it("lets an heir write in their own name, because that is real standing", () => {
    // Not a favour: an heir writes as themselves, with a death certificate and
    // a grant of probate behind them.
    expect(signsOwnLetters("deceased")).toBe(true);
    expect(needsProbate("deceased")).toBe(true);
  });

  it("does not ask for probate on anybody living", () => {
    for (const id of ["self", "parent", "grandparent"] as const) {
      expect(needsProbate(id)).toBe(false);
    }
  });

  it("marks exactly one route as having no standing to act, only to help", () => {
    const helpOnly = SUBJECTS.filter((s) => s.standing === "none").map((s) => s.id);
    expect(helpOnly).toEqual(["parent", "grandparent"]);
  });
});

describe("the suggestion is a starting point, never a computation", () => {
  it("suggests more employers for an older relative than for the user", () => {
    // Forgotten money accumulates with time and with job changes. The person
    // most likely to find something is the one least likely to install an app.
    expect(subjectProfile("parent")!.suggestedEmployers).toBeGreaterThan(
      subjectProfile("self")!.suggestedEmployers,
    );
  });

  it("changes nothing about what is found — only what is pre-filled", () => {
    // The number still comes from the person answering. A suggestion that
    // silently became an input would be a guess wearing an answer's clothes.
    const a = traceDormant({ pastEmployers: 5 }).leads.map((l) => l.source.id);
    const b = traceDormant({ pastEmployers: 5 }).leads.map((l) => l.source.id);
    expect(a).toEqual(b);
  });

  it("keeps every suggestion inside what the tracer will actually expand", () => {
    // A suggestion above the expansion cap would show a number the letters do
    // not match.
    for (const s of SUBJECTS) {
      expect(s.suggestedEmployers).toBeGreaterThan(0);
      expect(s.suggestedEmployers).toBeLessThanOrEqual(8);
    }
  });
});

describe("the catalogue", () => {
  it("resolves each subject and refuses an unknown one", () => {
    for (const s of SUBJECTS) expect(subjectProfile(s.id)).toBe(s);
    expect(subjectProfile("nobody")).toBeUndefined();
  });

  it("has no duplicates", () => {
    const ids = SUBJECTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
