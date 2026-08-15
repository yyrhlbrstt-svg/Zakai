import { describe, it, expect } from "vitest";
import { dedupeOutreachFooterLines } from "@/lib/outreachDedupe";

describe("dedupeOutreachFooterLines", () => {
  it("keeps one copy of a repeated machine line, in its first position", () => {
    const body = [
      "לכבוד סלקום,",
      "Machine: POST https://zakai.example.test/api/pipe/accept",
      "אבקש מענה בכתב.",
      "Machine: POST https://zakai.example.test/api/pipe/accept",
      "Machine: POST https://zakai.example.test/api/pipe/accept",
    ].join("\n");
    const out = dedupeOutreachFooterLines(body).split("\n");
    expect(out.filter((l) => l.startsWith("Machine:"))).toHaveLength(1);
    expect(out[1]).toBe("Machine: POST https://zakai.example.test/api/pipe/accept");
    expect(out).toContain("אבקש מענה בכתב.");
  });

  it("collapses a contact address repeated across three footers", () => {
    const body = [
      "לגוף שמקבל פניות: https://z.test/quickstart · ops@z.test",
      "בברכה,",
      "לגוף שמקבל פניות: https://z.test/quickstart · ops@z.test",
      "contact: ops@z.test",
      "לאוטומציה: ops@z.test",
    ].join("\n");
    const out = dedupeOutreachFooterLines(body);
    expect(out.match(/לגוף שמקבל פניות/g)).toHaveLength(1);
    // "contact:" and "לאוטומציה:" are the same address wearing two labels.
    // Measured in a real letter the address appeared five times this way.
    expect(out.match(/ops@z\.test/g)).toHaveLength(2);
  });

  it("drops the short machine line when a longer one says the same and more", () => {
    // The magnet line is a strict prefix of the full protocol line that
    // follows it. Both is saying it twice; the longer one says it completely.
    const body = [
      "Machine: POST https://z.test/api/pipe/accept",
      "כמה מילים.",
      "Machine: POST https://z.test/api/pipe/accept {jws} · JWKS https://z.test/jwks.json",
    ].join("\n");
    const out = dedupeOutreachFooterLines(body).split("\n").filter(Boolean);
    expect(out.filter((l) => l.startsWith("Machine:"))).toHaveLength(1);
    expect(out.join(" ")).toContain("JWKS");
    expect(out).toContain("כמה מילים.");
  });

  it("treats the same page in two locales as one line", () => {
    // A Hebrew letter to an Israeli company carried the institutional pointer
    // twice — once at /he/institutions and once at /en/institutions. The
    // second is noise to that recipient and doubles the appendix.
    const body = [
      "לגוף שמקבל פניות: https://z.test/he/institutions/quickstart",
      "Institutions: https://z.test/en/institutions/quickstart",
    ].join("\n");
    const out = dedupeOutreachFooterLines(body).split("\n").filter(Boolean);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("/he/");
  });

  it("does not merge two genuinely different endpoints", () => {
    const body = [
      "JWKS https://z.test/.well-known/a.json",
      "pipe https://z.test/.well-known/b.json",
      "inbound: https://z.test/api/institution/inbound-receive",
    ].join("\n");
    expect(dedupeOutreachFooterLines(body)).toBe(body);
  });

  it("never deduplicates prose, however identical", () => {
    // Two identical sentences in the body are the author's business. A footer
    // cleaner that edits the argument is a worse bug than the one it fixes.
    const body = ["אבקש מענה בכתב.", "משהו אחר.", "אבקש מענה בכתב."].join("\n");
    expect(dedupeOutreachFooterLines(body)).toBe(body);
  });

  it("treats lines differing only by surrounding whitespace as the same line", () => {
    const body = ["Machine: POST https://z.test/a", "  Machine: POST https://z.test/a  "].join("\n");
    expect(dedupeOutreachFooterLines(body).split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("keeps distinct URLs even when they share a prefix", () => {
    const body = ["JWKS https://z.test/.well-known/a.json", "pipe https://z.test/.well-known/b.json"].join(
      "\n",
    );
    expect(dedupeOutreachFooterLines(body)).toBe(body);
  });

  it("does not collapse blank-line structure below a paragraph break", () => {
    const body = "שורה\n\nשורה אחרת";
    expect(dedupeOutreachFooterLines(body)).toBe(body);
  });

  it("closes the gap left where a duplicate was removed", () => {
    const body = ["גוף", "", "Machine: POST https://z.test/a", "", "Machine: POST https://z.test/a", "", "סוף"].join(
      "\n",
    );
    const out = dedupeOutreachFooterLines(body);
    expect(out).not.toMatch(/\n{3,}/);
    expect(out.match(/Machine:/g)).toHaveLength(1);
  });

  it("leaves a letter with no repeats byte-identical", () => {
    // The common case. A cleaner that quietly reformats every letter it
    // touches would be changing what we send on every send.
    const body = "לכבוד סלקום,\n\nאבקש מענה בכתב.\n\nבברכה,\nזכאי";
    expect(dedupeOutreachFooterLines(body)).toBe(body);
  });
});
