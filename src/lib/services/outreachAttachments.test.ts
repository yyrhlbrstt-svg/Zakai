import { describe, expect, it } from "vitest";
import { mandateAttachClaimLine, shouldAttachMandateDocs } from "./outreachAttachments";
import { AGENT_SUBJECT_PREFIX } from "./loopLimits";

describe("shouldAttachMandateDocs", () => {
  it("attaches for agent follow-up subjects", () => {
    expect(shouldAttachMandateDocs(`${AGENT_SUBJECT_PREFIX} 2 — תזכורת`)).toBe(true);
  });

  it("attaches for initial outreach with authorization code", () => {
    expect(
      shouldAttachMandateDocs("בקשת התאמת מסלול בשם ישראל — הרשאה ZK-ABCD12"),
    ).toBe(true);
  });

  it("does not attach consumer notify / fee subjects", () => {
    expect(shouldAttachMandateDocs("זכאי — נשלח ל-סלקום | מה הלאה")).toBe(false);
    expect(shouldAttachMandateDocs("זכאי — הסוכן שלח פנייה חוזרת ל-סלקום (סיבוב 2)")).toBe(
      false,
    );
    expect(shouldAttachMandateDocs(null)).toBe(false);
  });
});

describe("mandateAttachClaimLine", () => {
  it("never invents JSON inbound when only HTML was attached", () => {
    const htmlOnly = mandateAttachClaimLine(false);
    expect(htmlOnly).toContain("HTML");
    expect(htmlOnly).not.toContain("JSON inbound");
  });

  it("claims JSON inbound when the inbound attachment is present", () => {
    const full = mandateAttachClaimLine(true);
    expect(full).toContain("JSON inbound");
    expect(full).toContain("zakai-inbound-receive");
  });
});
