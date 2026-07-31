/**
 * Making the chosen stance actually change the letter.
 *
 * WHY THIS HAD TO EXIST BEFORE THE OTHER VERTICALS COULD LEARN
 *
 * `chooseStance()` was wired into exactly one route — the telecom flow, where
 * an LLM writes the prose and can simply be told how to pitch it. The other
 * seven full-service verticals build their letters deterministically, so there
 * was no prompt to steer.
 *
 * The tempting shortcut is to call `chooseStance()` there anyway and record the
 * variant on the case. That would light up the dashboard and quietly poison the
 * evidence base: every observation would be attributed to a stance that had no
 * effect on what was sent. The engine would then learn, with perfect internal
 * consistency, which label we happened to draw — and start steering real
 * people's claims on it. Fabricated evidence is worse than none, because none
 * is visibly absent and fabricated evidence is confidently wrong.
 *
 * So the stance is applied here, to the deterministic letter itself, along the
 * exact dimensions the engine measures. What was chosen and what went out are
 * then the same thing, and the attribution is true.
 *
 * Pure: same letter and stance in, same letter out. The text a customer
 * approved must be reproducible from the case record alone.
 */

import type { StrategyVariant } from "./types";

export interface Letter {
  subject: string;
  body: string;
}

/** Days to reply, when the stance sets one. */
const DEADLINE_DAYS = 14;

/**
 * Hebrew, because these are the deterministic Israeli letter builders. When a
 * second market gets deterministic builders, this becomes a per-market table —
 * the same shape as the jurisdiction packs, for the same reason.
 */
const CLAUSES = {
  deadline: `אבקש תשובה עניינית בכתב תוך ${DEADLINE_DAYS} ימים ממועד קבלת פנייה זו.`,
  escalation:
    "ככל שהבקשה תידחה, אבקש הנמקה מפורטת בכתב, ואפנה לגורם המוסמך לבירור התלונה בהתאם לדין.",
  statute: "הבקשה מבוססת על ההוראות החלות בעניין זה.",
  anchorAsk:
    "אבקש שתחשבו את הסכום המדויק המגיע לי ותציינו אותו בתשובתכם, בצירוף אופן החישוב.",
  cooperative: "אני מניח/ה שמדובר בטעות ומבקש/ת לתקנה ללא צורך בהליך נוסף.",
  formal: "פנייה זו נשלחת לשם בירור וטיפול, ושמורות לי מלוא טענותיי וזכויותיי.",
} as const;

/**
 * Apply a stance to a finished letter.
 *
 * Only additive: it appends qualifying paragraphs and never rewrites the
 * substance. The body of a claim states facts about a person's account and a
 * legal basis, and an optimiser must not be able to touch either — the space it
 * is allowed to explore is tone and procedure, not what we assert on somebody's
 * behalf.
 */
export function applyStance(letter: Letter, variant: StrategyVariant): Letter {
  const additions: string[] = [];

  if (variant.posture === "cooperative") additions.push(CLAUSES.cooperative);
  if (variant.posture === "formal_legal") additions.push(CLAUSES.formal);

  // Only claim a statutory basis when the letter does not already cite one —
  // a second, vaguer assertion next to a specific citation weakens it.
  if (variant.citesStatute && !/סעיף|חוק|תקנה|צו /.test(letter.body)) {
    additions.push(CLAUSES.statute);
  }

  if (variant.setsDeadline && !/\d+\s*ימים/.test(letter.body)) {
    additions.push(CLAUSES.deadline);
  }
  if (variant.namesEscalation) additions.push(CLAUSES.escalation);

  // `anchorsAmount: false` is the instruction to make the recipient compute the
  // figure. When it is true the deterministic builder has already stated the
  // amount, so there is nothing to add — the dimension is expressed by the
  // absence of this ask, not by a clause.
  if (!variant.anchorsAmount) additions.push(CLAUSES.anchorAsk);

  if (additions.length === 0) return letter;

  // Inserted before the sign-off when there is one, so the letter still reads
  // like a letter rather than a document with paragraphs after the signature.
  const signOffIndex = letter.body.lastIndexOf("בכבוד רב");
  const block = additions.join("\n\n");

  if (signOffIndex === -1) {
    return { subject: letter.subject, body: `${letter.body.trimEnd()}\n\n${block}` };
  }
  return {
    subject: letter.subject,
    body: `${letter.body.slice(0, signOffIndex).trimEnd()}\n\n${block}\n\n${letter.body.slice(signOffIndex)}`,
  };
}

/**
 * True when this stance would change this letter at all.
 *
 * Used to decide whether an outcome may honestly be attributed to the stance.
 * If applying it is a no-op, the claim went out exactly as it would have
 * anyway, and recording it under that label is the fabrication this module
 * exists to prevent.
 */
export function stanceAffects(letter: Letter, variant: StrategyVariant): boolean {
  return applyStance(letter, variant).body !== letter.body;
}
