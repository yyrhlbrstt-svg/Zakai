import { describe, expect, it } from "vitest";
import { buildBrandedEmailHtml } from "./emailTemplate";

describe("buildBrandedEmailHtml", () => {
  it("wraps a Hebrew body in RTL markup with the Zakai mark and the exact body text preserved", () => {
    const html = buildBrandedEmailHtml("בקשת אימות בעלות", "שלום,\n\nזהו תוכן המכתב.\n\nבברכה");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("Zakai");
    expect(html).toContain("icon-192.png");
    expect(html).toContain("שלום,\n\nזהו תוכן המכתב.\n\nבברכה");
    expect(html).toContain("בקשת אימות בעלות");
  });

  it("wraps an English body in LTR markup", () => {
    const html = buildBrandedEmailHtml("Ownership verification", "Hello,\n\nThis is the letter body.");
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("Sent via Zakai");
  });

  it("escapes HTML-significant characters in the subject and body — never injects raw markup", () => {
    const html = buildBrandedEmailHtml(
      "<script>alert(1)</script>",
      "Amount: 5 < 10 & \"quoted\"",
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;quoted&quot;");
  });

  it("never claims the letter is authored by Zakai — only that it was sent via Zakai", () => {
    const html = buildBrandedEmailHtml("נושא", "תוכן");
    expect(html).toMatch(/נשלח באמצעות זכאי/);
    expect(html).not.toMatch(/מאת זכאי|מזכאי בלבד/);
  });

  it("defaults to LTR direction for a subject/body with no Hebrew characters at all", () => {
    const html = buildBrandedEmailHtml("Plain subject", "Plain body, no Hebrew here.");
    expect(html).toContain('dir="ltr"');
  });
});
