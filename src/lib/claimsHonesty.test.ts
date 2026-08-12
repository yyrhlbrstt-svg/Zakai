import { describe, expect, it } from "vitest";
import he from "@/messages/he.json";
import en from "@/messages/en.json";

/**
 * No claim this product cannot keep.
 *
 * WHY THIS TEST EXISTS AND WHY NOW
 *
 * In 2025 the FTC issued a final order against DoNotPay over its "AI lawyer"
 * marketing — refunds to users and mandatory disclosures — not because the
 * software crashed but because of what the copy said it could do. That is the
 * failure mode this product is most exposed to, because the honest version of
 * what Zakai does ("drafts a letter you send, under an authority you can
 * revoke") is one adjective away from a claim a regulator would act on
 * ("fights your case for you").
 *
 * The existing non-negotiables already cover the two worst versions: never
 * fabricate eligibility, and never say we will call somebody back. This turns
 * both into something that fails a build rather than something a person has to
 * remember while writing a placeholder at midnight — which is exactly how the
 * one violation this test was written to catch got in.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not flag the word "lawyer" or "legal advice". Those appear in forty
 * places in this catalogue and nearly every one is a *disclaimer* — "Zakai is
 * not a lawyer, does not provide legal advice". A check that flagged those
 * would be deleted within a week, and would be pushing in the wrong direction:
 * the disclaimers are the good part.
 *
 * So there are two rules, and both are about affirmative claims:
 *
 *  1. BANNED outright — phrases with no honest use in this product at all.
 *  2. NEGATION-ONLY — phrases allowed only in a sentence that denies them.
 */

/** Phrases that are a claim however they are framed. */
const BANNED: { pattern: RegExp; why: string }[] = [
  {
    pattern: /נחזור אליך|נחזור אליכם|ניצור איתך קשר טלפוני/,
    why: 'promising a callback — there is no callback team; every path finishes in the app',
  },
  {
    pattern: /\bwe(?:'ll| will| shall)? (?:get back to you|call you back)\b/i,
    why: "promising a callback — there is no callback team",
  },
  {
    pattern: /עורך[ -]דין AI|עוה"ד שלך|עורך הדין שלך/,
    why: 'positioning the product as the user\'s lawyer — the exact claim the FTC acted on',
  },
  {
    pattern: /\bAI lawyer\b|\byour lawyer\b|\brobot lawyer\b/i,
    why: "positioning the product as the user's lawyer",
  },
  {
    pattern: /הגשנו (?:עבורך|בשמך|תלונה|תביעה)|הגשנו לרשות/,
    why: "claiming to have filed with a body when the product only drafts text",
  },
  {
    pattern: /\bwe (?:have )?filed\b|\bwe submitted (?:a )?(?:claim|complaint) (?:for|on behalf of) you\b/i,
    why: "claiming to have filed when the product only drafts text",
  },
  {
    pattern: /(?:אנחנו )?מבטיחים לך|החזר מובטח|חיסכון מובטח|בטוח תקבל|מובטח שתקבל/,
    why: "guaranteeing an outcome — no outcome is guaranteed",
  },
  {
    pattern: /\bwe guarantee\b|\bguaranteed (?:refund|saving|payout|result)\b/i,
    why: "guaranteeing an outcome — no outcome is guaranteed",
  },
  {
    pattern: /(?:אנחנו )?(?:נייצג|מייצגים) אותך|נלחם עבורך בבית המשפט/,
    why: "claiming representation — Zakai never represents anyone in a proceeding",
  },
  {
    pattern: /\bwe(?:'ll| will)? represent you\b|\bwe fight your case\b/i,
    why: "claiming representation",
  },
];

/**
 * Claims that are only a problem when *we* are the one making them.
 *
 * "Legal advice" appears forty times in this catalogue and nearly every one is
 * a disclaimer. What matters is not the phrase but the subject: "Zakai does
 * not provide legal advice" and "Zakai provides legal advice" contain the same
 * words and are opposite statements. So these patterns require a first-person
 * subject attached to the verb, rather than trying to detect a negation
 * somewhere in a paragraph — which is the version of this check that flagged
 * six disclaimers on its first run.
 */
const ATTRIBUTED: { pattern: RegExp; why: string }[] = [
  {
    pattern: /(?:זכאי|אנחנו|אנו)\s+(?:\S+\s+){0,3}?(?:נותן|נותנת|נותנים|מספק\S*|מעניק\S*|מציע\S*|מייעץ|מייעצת)\s+(?:\S+\s+){0,2}?ייעוץ משפטי/,
    why: "claiming to provide legal advice",
  },
  {
    pattern: /\b(?:we|zakai)\b(?:\s+\S+){0,3}\s+(?:provides?|gives?|offers?)\b(?:\s+\S+){0,2}\s+legal advice/i,
    why: "claiming to provide legal advice",
  },
];

/**
 * Words that turn the claim beside them into its own denial.
 *
 * Applied uniformly to every banned pattern rather than written into each one:
 * "No call centre, no 'we'll call you back'" and "No guaranteed refund" are
 * both the product stating a limit, and a check that could not tell those from
 * the claim itself would be training people to ignore it.
 */
const NEGATORS =
  /(?:\b(?:no|not|never|without|isn'?t|aren'?t|doesn'?t|does not|do not|don'?t|nor)\b|אינ[הוםן]?|איננו|אינם|אין|ללא|בלי|לא)/i;

/** Is the claim at `index` inside a sentence that is denying it? */
function denied(text: string, index: number): boolean {
  // Look back to the start of the sentence, capped, so a denial two sentences
  // earlier cannot license a claim made here.
  const from = Math.max(0, index - 60);
  const before = text.slice(from, index);
  const sentenceStart = Math.max(before.lastIndexOf("."), before.lastIndexOf("—"));
  return NEGATORS.test(sentenceStart >= 0 ? before.slice(sentenceStart) : before);
}

interface Finding {
  path: string;
  text: string;
  why: string;
}

function walk(node: unknown, path: string, out: (p: string, s: string) => void): void {
  if (typeof node === "string") out(path, node);
  else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      walk(v, path ? `${path}.${k}` : k, out);
    }
  }
}

function scan(catalogue: unknown): Finding[] {
  const findings: Finding[] = [];
  walk(catalogue, "", (path, text) => {
    for (const { pattern, why } of [...BANNED, ...ATTRIBUTED]) {
      const m = pattern.exec(text);
      if (m && !denied(text, m.index)) findings.push({ path, text, why });
    }
  });
  return findings;
}

function report(findings: Finding[]): string {
  return findings
    .map((f) => `\n  ${f.path}\n    ${f.why}\n    "${f.text.slice(0, 140)}"`)
    .join("");
}

describe("no claim this product cannot keep", () => {
  it("finds the catalogues at all", () => {
    // Without this, a renamed messages file would leave the whole check
    // passing over nothing.
    expect(Object.keys(he).length).toBeGreaterThan(100);
    expect(Object.keys(en).length).toBeGreaterThan(100);
  });

  it("the Hebrew catalogue makes no promise the product cannot keep", () => {
    const findings = scan(he);
    expect(findings, report(findings)).toEqual([]);
  });

  it("the English catalogue makes no promise the product cannot keep", () => {
    const findings = scan(en);
    expect(findings, report(findings)).toEqual([]);
  });

  it("actually catches each banned claim, in both languages", () => {
    // A guard nobody has watched fail is a guard nobody should trust. These are
    // the exact strings the rules above exist to stop.
    const shouldFail = [
      { feedback: "אימייל (רק אם תרצה שנחזור אליך)" },
      { hero: "עורך דין AI בכיס שלך" },
      { hero: "Your AI lawyer, in your pocket" },
      { case: "הגשנו בשמך תלונה לרשות להגנת הצרכן" },
      { promo: "החזר מובטח תוך 30 יום" },
      { promo: "We guarantee a refund within 30 days" },
      { promo: "אנחנו נייצג אותך מול הספק" },
      { promo: "We will represent you against the provider" },
      { advice: "זכאי נותן לך ייעוץ משפטי מלא" },
      { advice: "Zakai gives you full legal advice" },
    ];
    for (const sample of shouldFail) {
      expect(scan(sample), `not caught: ${JSON.stringify(sample)}`).not.toEqual([]);
    }
  });

  it("leaves the disclaimers alone — they are the good part", () => {
    const shouldPass = [
      { d: "זכאי אינו עורך דין, אינו נותן ייעוץ משפטי ואינו מייצג אותך בהליך כלשהו." },
      { d: "Zakai is not a lawyer, does not provide legal advice, and does not represent you." },
      { d: "אומדן בלבד — לא ייעוץ משפטי, והזכאות תלויה בנסיבות." },
      { d: "An estimate only — not legal advice." },
      { d: "שום תוצאה או חיסכון אינם מובטחים." },
      { d: "פנסיית מינימום מובטחת מהמדינה." },
      { d: "A guaranteed minimum state pension." },
    ];
    for (const sample of shouldPass) {
      expect(scan(sample), `false positive on: ${JSON.stringify(sample)}`).toEqual([]);
    }
  });
});
