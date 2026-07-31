/**
 * Checking for somebody else — the only mechanic here that compounds.
 *
 * WHY THIS AND NOT A SHARE BUTTON
 *
 * A share button asks somebody to advertise a money app to their friends, which
 * is a thing almost nobody does: telling people you are chasing money you are
 * owed is a status admission, and the ones with the most to claim are the least
 * likely to make it. Every consumer-finance product discovers this eventually.
 *
 * Doing it *for* a parent inverts the whole thing. It is a favour, not a
 * confession, and it is the rare kind of favour that costs one tap and might be
 * worth thousands. People talk about that.
 *
 * AND THE ARITHMETIC IS ON ITS SIDE
 *
 * Forgotten money accumulates with time and with job changes. A twenty-eight
 * year old has had two employers; their father has had nine, across decades when
 * paperwork was posted rather than emailed, through a house move or two that
 * broke the address on file, and with policies sold in person by agents nobody
 * remembers. The person most likely to find something is precisely the person
 * least likely to install an app to look.
 *
 * THE HONESTY CONSTRAINT THAT SHAPES ALL OF IT
 *
 * A living relative signs their own letters. We are not acting for them, they
 * have not authorised anything, and a demand that arrives over a parent's name
 * without their knowledge is forgery however kindly meant. So for anyone living,
 * this produces a document to hand them — addressed from them, signed by them —
 * and says so plainly.
 *
 * The deceased case is different and already handled: an heir writes in their
 * own name, with a death certificate and a grant of probate, and that is a real
 * legal standing rather than a favour.
 */

export type Subject = "self" | "parent" | "grandparent" | "deceased";

export interface SubjectProfile {
  id: Subject;
  /**
   * Typical number of former employers, used only to pre-fill the question —
   * never to compute anything. The person still answers it.
   */
  suggestedEmployers: number;
  /** Who signs the letters. The line that keeps this honest. */
  signedBy: "you" | "them";
  /** Whether legal standing exists to act, rather than merely to help. */
  standing: "own" | "none" | "heir";
}

export const SUBJECTS: readonly SubjectProfile[] = [
  { id: "self", suggestedEmployers: 3, signedBy: "you", standing: "own" },
  // Decades of employment, most of it before anything was emailed.
  { id: "parent", suggestedEmployers: 5, signedBy: "them", standing: "none" },
  { id: "grandparent", suggestedEmployers: 5, signedBy: "them", standing: "none" },
  // The only case where somebody else may write in their own name, and it needs
  // a death certificate and a grant of probate to do it.
  { id: "deceased", suggestedEmployers: 5, signedBy: "you", standing: "heir" },
];

export function subjectProfile(id: string): SubjectProfile | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

/**
 * May this person's letters be signed by the one holding the phone?
 *
 * The single question that decides whether this is a helpful document or a
 * forged one. Exported so no screen has to re-derive it, and so a future screen
 * cannot get it wrong.
 */
export function signsOwnLetters(id: Subject): boolean {
  return subjectProfile(id)?.signedBy === "you";
}

/**
 * Does this route need probate paperwork before anybody writes anything?
 */
export function needsProbate(id: Subject): boolean {
  return subjectProfile(id)?.standing === "heir";
}
