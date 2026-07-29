import { describe, expect, it } from "vitest";
import { buildSwitchLetter, productNameHe } from "./letters";
import { IL_CAPTIVE, captiveById } from "./products";

const MORTGAGE = captiveById("mortgage_life_insurance")!;
const SECURITIES = captiveById("bank_securities_fees")!;

describe("the letter matches the situation, not the wish", () => {
  it("gives notice where the person can simply leave", () => {
    const l = buildSwitchLetter(MORTGAGE);
    expect(l.kind).toBe("notice");
    expect(l.body).toContain("כוונתי להעביר");
  });

  it("asks for repricing where the incumbent has to cooperate", () => {
    // A notice of departure to a counterparty who controls the exit is a bluff,
    // and a called bluff teaches the person the product overstated their hand.
    const l = buildSwitchLetter(SECURITIES);
    expect(l.kind).toBe("reprice");
    expect(l.body).toContain("עדכון התנאים");
  });

  it("matches kind to the product flag for every entry", () => {
    for (const p of IL_CAPTIVE) {
      expect(buildSwitchLetter(p).kind).toBe(p.switchableWithoutIncumbent ? "notice" : "reprice");
    }
  });
});

describe("what the letter says and refuses to say", () => {
  it("cites the right to switch in every letter", () => {
    // Without the citation this is a request. With it, it is a position.
    for (const p of IL_CAPTIVE) {
      expect(buildSwitchLetter(p).body).toContain(p.rightToSwitch);
    }
  });

  it("never states a saving", () => {
    // Our figure is a range about a market; theirs is a fact about this person.
    // Putting ours in a letter invites a correction that ends the conversation.
    for (const p of IL_CAPTIVE) {
      const body = buildSwitchLetter(p, { currentMonthlyMinor: 40_000 }).body;
      expect(body).not.toMatch(/חוסך|חיסכון|תוכל לחסוך/);
      expect(body).not.toMatch(/\d+%/);
    }
  });

  it("asks for a deadline and a written answer, in every letter", () => {
    for (const p of IL_CAPTIVE) {
      const body = buildSwitchLetter(p).body;
      expect(body).toContain("14 ימי עסקים");
      expect(body).toContain("בכתב");
    }
  });

  it("names the product in Hebrew rather than printing an internal id", () => {
    for (const p of IL_CAPTIVE) {
      const named = productNameHe(p);
      expect(named).not.toBe(p.id);
      expect(buildSwitchLetter(p).subject).toContain(named);
    }
  });
});

describe("missing details stay visible", () => {
  it("leaves legible blanks rather than quietly omitting identifiers", () => {
    // A letter that reads fine without a policy number gets sent without one
    // and bounces. A bracketed blank is an instruction the sender can see.
    const body = buildSwitchLetter(MORTGAGE).body;
    expect(body).toContain("[שם מלא]");
    expect(body).toContain("[מספר זהות]");
  });

  it("uses the details it was given", () => {
    const l = buildSwitchLetter(MORTGAGE, {
      name: "דנה כהן",
      id: "012345678",
      reference: "POL-99",
      currentMonthlyMinor: 18_050,
    });
    expect(l.body).toContain("דנה כהן");
    expect(l.body).toContain("012345678");
    expect(l.body).toContain("POL-99");
    expect(l.body).not.toContain("[שם מלא]");
  });

  it("states the current charge only when the person gave one", () => {
    expect(buildSwitchLetter(MORTGAGE, { currentMonthlyMinor: 18_000 }).body).toContain("₪180");
    expect(buildSwitchLetter(MORTGAGE).body).not.toContain("החיוב החודשי הנוכחי");
  });

  it("sends nobody to another website", () => {
    // The category exists because the alternative was never visible. Answering
    // that with a link is handing the problem back.
    for (const p of IL_CAPTIVE) {
      expect(buildSwitchLetter(p).body).not.toMatch(/https?:\/\//);
    }
  });
});
