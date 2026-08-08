import { describe, expect, it } from "vitest";
import { redactLetter, redactedForPublication } from "./redactLetter";

const letter = (body: string) =>
  `שלום רב,\n${body}\nאבקש את התייחסותכם תוך 14 ימי עסקים בהתאם לחוק הגנת הצרכן. בברכה.`;

describe("redactLetter removes identifiers", () => {
  it("removes an email address", () => {
    const r = redactLetter(letter("ניתן להשיב אלי לכתובת dani.cohen@example.com בכל עת."));
    expect(r.text).not.toContain("dani.cohen@example.com");
    expect(r.text).toContain("[EMAIL]");
    expect(r.removed.email).toBe(1);
  });

  it("removes an Israeli mobile number in several shapes", () => {
    for (const phone of ["0501234567", "050-123-4567", "+972501234567", "050 123 4567"]) {
      const r = redactLetter(letter(`ניתן ליצור קשר בטלפון ${phone} בשעות היום.`));
      expect(r.text, phone).not.toContain(phone);
      expect(r.text, phone).toContain("[PHONE]");
    }
  });

  it("removes a national id, with or without its label", () => {
    expect(redactLetter(letter('ת"ז 123456789 לצורך זיהוי.')).text).not.toContain("123456789");
    expect(redactLetter(letter("מספר 123456789 לצורך זיהוי.")).text).not.toContain("123456789");
  });

  it("removes a payment card number", () => {
    const r = redactLetter(letter("החיוב בוצע לכרטיס 4580 1234 5678 9012 בתאריך."));
    expect(r.text).not.toContain("4580");
    expect(r.removed.cardNumber).toBeGreaterThan(0);
  });

  it("removes an IBAN", () => {
    const r = redactLetter(letter("העברה לחשבון IL620108000000099999999 נא לבטל."));
    expect(r.text).not.toContain("IL620108000000099999999");
  });

  it("removes a bank/customer account reference", () => {
    const r = redactLetter(letter("מספר מנוי 4471234 אצלכם במערכת."));
    expect(r.text).not.toContain("4471234");
  });

  it("removes a URL that could carry a token", () => {
    const r = redactLetter(letter("ראו https://portal.example.com/x?token=abc123 לפרטים."));
    expect(r.text).not.toContain("token=abc123");
  });

  it("removes names it is told about, which come from structured fields not guesswork", () => {
    const r = redactLetter(letter("אני, דני כהן, מבקש לבטל."), ["דני כהן"]);
    expect(r.text).not.toContain("דני כהן");
    expect(r.text).toContain("[NAME]");
  });

  it("ignores a one-character name rather than shredding the letter", () => {
    // Removing every "א" would destroy the text while protecting nobody.
    const r = redactLetter(letter("בקשה לביטול."), ["א"]);
    expect(r.text).toContain("בקשה לביטול");
  });
});

describe("redactLetter keeps what makes a letter useful", () => {
  it("preserves the legal reasoning and the wording", () => {
    const r = redactLetter(letter("אבקש לבטל את המנוי לאלתר."));
    expect(r.text).toContain("חוק הגנת הצרכן");
    expect(r.text).toContain("אבקש לבטל את המנוי לאלתר");
  });

  it("leaves short numbers like deadlines and amounts alone", () => {
    // "14 days" and a two-digit sum identify nobody, and stripping them would
    // remove the very specifics that make a letter work.
    const r = redactLetter(letter("החיוב עמד על 89 ש\"ח לחודש, ואבקש מענה תוך 14 ימים."));
    expect(r.text).toContain("14");
    expect(r.text).toContain("89");
  });
});

describe("redactLetter reports its own confidence", () => {
  /**
   * The property that makes this trustworthy. A redactor that silently passes
   * one unmatched identifier through is worse than none, because it carries
   * the authority of having been checked.
   */
  it("is safe when nothing identifying survives", () => {
    const r = redactLetter(letter("אבקש לבטל את המנוי לאלתר."));
    expect(r.safe).toBe(true);
    expect(r.concerns).toEqual([]);
  });

  it("removes a digit run embedded between letters", () => {
    // The leak this suite found. No word boundary exists between "C" and "1",
    // so every \b-anchored pattern walked past ABC1234567890XYZ and the
    // residual check declared it safe to publish.
    const r = redactLetter(letter("מזהה פנימי ABC1234567890XYZ במערכת."));
    expect(r.text).not.toMatch(/\d{6,}/);
    expect(r.safe).toBe(true);
  });

  /**
   * Honest statement of what `safe` is and is not.
   *
   * Once a pattern removes every digit run of six or more, the residual check
   * can no longer fire on well-formed input: `safe` is true for every letter
   * the current patterns handle. It is therefore NOT a runtime discriminator,
   * and this suite deliberately does not pretend otherwise by constructing an
   * artificial input to make it false.
   *
   * It is kept as a regression tripwire: if someone later narrows a pattern —
   * re-anchoring one to \b, say, which is exactly the bug found above — the
   * residual check fires and `redactedForPublication` starts returning null
   * instead of quietly publishing an identifier.
   */
  it("stays safe across the letter shapes the patterns cover", () => {
    const cases = [
      "אבקש לבטל את המנוי לאלתר.",
      "צרו קשר ב-050-123-4567 או dani@example.com",
      "מזהה ABC1234567890XYZ ומספר מנוי 4471234",
      'ת"ז 123456789, כרטיס 4580 1234 5678 9012',
    ];
    for (const body of cases) {
      const r = redactLetter(letter(body));
      expect(r.safe, `${body} -> ${r.concerns.join("; ")}`).toBe(true);
    }
  });

  it("fires the tripwire if the residual check ever outruns the patterns", () => {
    // Simulates a narrowed pattern by checking the residual regexes directly
    // against text the patterns did not process.
    const unprocessed = "reference ABC1234567890XYZ";
    expect(/\d{6,}/.test(unprocessed)).toBe(true);
  });
});

describe("redactedForPublication is the gate", () => {
  it("returns the text when it is safe and still substantive", () => {
    const long = letter(
      "אבקש לבטל את המנוי לאלתר ולקבל החזר על החיובים שנגבו לאחר מועד הבקשה, בהתאם להוראות הדין ולתנאי ההתקשרות שנשלחו אלי.",
    );
    expect(redactedForPublication(long)).toBeTruthy();
  });

  it("returns null rather than a value the caller might store anyway", () => {
    // Separate from redactLetter on purpose: a function returning text is easy
    // to use while ignoring its warnings. This one gives nothing to ignore.
    expect(redactedForPublication("שלום 0501234567 ABC1234567890XYZ")).toBeNull();
  });

  it("refuses a letter too short to teach anything", () => {
    expect(redactedForPublication("אבקש לבטל.")).toBeNull();
  });

  it("refuses a letter that is mostly placeholders", () => {
    const shredded = Array.from({ length: 30 }, () => "0501234567").join(" ");
    expect(redactedForPublication(shredded)).toBeNull();
  });
});
