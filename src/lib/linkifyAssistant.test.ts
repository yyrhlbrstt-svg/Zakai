import { describe, expect, it } from "vitest";
import { hasLink, linkifyAssistantText, type AssistantSegment } from "./linkifyAssistant";

const links = (segs: AssistantSegment[]) =>
  segs.filter((s): s is Extract<AssistantSegment, { kind: "link" }> => s.kind === "link");
const rendered = (segs: AssistantSegment[]) =>
  segs.map((s) => (s.kind === "link" ? s.label : s.value)).join("");

describe("linkifyAssistantText", () => {
  /**
   * The exact message from the reported screenshot. Rendered as plain text in
   * an RTL paragraph, bidi reordering shows this path as "money?/case=…" — a
   * scrambled string at the last step of the loop, when the person has already
   * agreed to everything.
   */
  it("links the case path the agent tells you to open", () => {
    const msg =
      "היכנס לתיק והזן את כתובת המייל של הספק כדי להמשיך בשליחה ובמשא ומתן: /money?case=cmsc5vwt90001l904uw6htfo5";
    const segs = linkifyAssistantText(msg);
    expect(links(segs)).toHaveLength(1);
    expect(links(segs)[0].href).toBe("/money?case=cmsc5vwt90001l904uw6htfo5");
  });

  it("never loses or reorders the original text", () => {
    const msg = "פתחו /money?case=abc ואז /check להמשך.";
    expect(rendered(linkifyAssistantText(msg))).toBe(msg);
  });

  it("links several destinations in one reply", () => {
    const segs = linkifyAssistantText("אפשר /money או /cancel או /bank-fees");
    expect(links(segs).map((l) => l.href)).toEqual(["/money", "/cancel", "/bank-fees"]);
  });

  it("keeps sentence punctuation out of the href", () => {
    // "open /money." must not link "/money." — that path does not exist.
    const segs = linkifyAssistantText("היכנסו ל/money.");
    expect(links(segs)[0].href).toBe("/money");
    expect(rendered(linkifyAssistantText("היכנסו ל/money."))).toBe("היכנסו ל/money.");
  });

  it("handles a path in parentheses", () => {
    const segs = linkifyAssistantText("(ראו /dashboard) להמשך");
    expect(links(segs)[0].href).toBe("/dashboard");
  });

  /**
   * The safety property. A model that hallucinates a domain must not become a
   * one-tap route off the site, so only the closed list of in-app paths links.
   */
  it("refuses to link an external URL from model output", () => {
    const segs = linkifyAssistantText("ראו https://evil.example.com/x לפרטים");
    expect(links(segs)).toHaveLength(0);
  });

  it("refuses to link a path that is not on the allowed list", () => {
    expect(links(linkifyAssistantText("נסו /admin או /internal/secrets"))).toHaveLength(0);
  });

  it("links a nested path under an allowed prefix", () => {
    expect(links(linkifyAssistantText("ראו /cancel/universal"))[0].href).toBe("/cancel/universal");
  });

  it("does not link a prefix that merely starts with an allowed name", () => {
    // "/moneybox" is not "/money".
    expect(links(linkifyAssistantText("ראו /moneybox"))).toHaveLength(0);
  });

  it("returns one text segment when there is nothing to link", () => {
    const segs = linkifyAssistantText("שלום, אין כאן קישור.");
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ kind: "text", value: "שלום, אין כאן קישור." });
    expect(hasLink(segs)).toBe(false);
  });

  it("survives an empty message", () => {
    expect(linkifyAssistantText("")).toEqual([{ kind: "text", value: "" }]);
  });

  it("preserves newlines, which carry the message's structure", () => {
    const msg = "שורה ראשונה\n\nפתחו /money?case=abc\n\nבברכה";
    expect(rendered(linkifyAssistantText(msg))).toBe(msg);
  });
});

describe("hasLink", () => {
  it("is true once something is pressable", () => {
    expect(hasLink(linkifyAssistantText("פתחו /money"))).toBe(true);
  });
});
