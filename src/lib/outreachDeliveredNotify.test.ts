import { describe, expect, it } from "vitest";
import { AGENT_SUBJECT_PREFIX } from "@/lib/services/loopLimits";
import {
  classifyProviderOutreachForNotify,
  outreachDeliveredPush,
  outreachDeliveredUserSubject,
} from "@/lib/outreachDeliveredNotify";

describe("classifyProviderOutreachForNotify", () => {
  it("classifies initial Mandate outreach by authorization code", () => {
    expect(
      classifyProviderOutreachForNotify("בקשת התאמת מסלול בשם ישראל — הרשאה ZK-ABCD12"),
    ).toEqual({ kind: "initial" });
  });

  it("classifies agent follow-up rounds", () => {
    expect(
      classifyProviderOutreachForNotify(`${AGENT_SUBJECT_PREFIX} 2 — תזכורת`),
    ).toEqual({ kind: "followup", round: 2 });
  });

  it("ignores user-facing status mail (never recurse on notify Outbox)", () => {
    expect(classifyProviderOutreachForNotify("זכאי — נשלח ל-סלקום | מה הלאה")).toBeNull();
    expect(
      classifyProviderOutreachForNotify("זכאי — הסוכן שלח פנייה חוזרת ל-סלקום (סיבוב 2)"),
    ).toBeNull();
    expect(
      classifyProviderOutreachForNotify("זכאי — הפנייה ל-סלקום בתור שליחה | מה הלאה"),
    ).toBeNull();
  });

  it("ignores empty / unrelated subjects", () => {
    expect(classifyProviderOutreachForNotify(null)).toBeNull();
    expect(classifyProviderOutreachForNotify("Invoice #12")).toBeNull();
  });
});

describe("outreachDelivered copy", () => {
  it("keeps initial vs follow-up subjects distinct", () => {
    expect(outreachDeliveredUserSubject({ kind: "initial" }, "סלקום")).toContain("נשלח ל-סלקום");
    expect(
      outreachDeliveredUserSubject({ kind: "followup", round: 3 }, "סלקום"),
    ).toContain("סיבוב 3");
  });

  it("tags push so retries do not invent a second device alert class", () => {
    expect(
      outreachDeliveredPush({
        kind: { kind: "initial" },
        provider: "סלקום",
        proofsAddr: "proofs@x",
        caseId: "c1",
      }).tag,
    ).toBe("sent-c1");
    expect(
      outreachDeliveredPush({
        kind: { kind: "followup", round: 2 },
        provider: "סלקום",
        proofsAddr: "proofs@x",
        caseId: "c1",
      }).tag,
    ).toBe("followup-c1-r2");
  });
});
