/**
 * One thing. Not a list of one thing — one thing.
 *
 * THE CONVENIENCE BUG WE BUILT OURSELVES
 *
 * The navigation carries sixty-four links. Five money engines now feed it, and
 * the honest reading of that is that the product got broader while getting
 * harder to use, which is the opposite of the instruction. Iyengar and Lepper's
 * jam study is the canonical measurement of the effect: a table of twenty-four
 * varieties drew more attention than a table of six and converted at roughly a
 * tenth of the rate. Choice attracts; it does not act.
 *
 * A person who opens a money app has one question, and it is not "what is
 * available". It is "what should I do now". Every screen that answers with a
 * menu has handed the work back.
 *
 * THE RESEARCH THIS IS ACTUALLY BUILT ON
 *
 * - Choice overload (Iyengar & Lepper 2000): fewer options, more action. So the
 *   answer is exactly one, and the runners-up are behind a disclosure.
 * - Loss aversion (Kahneman & Tversky 1979): a loss weighs roughly twice a gain
 *   of the same size. A deadline on money already owed therefore outranks a
 *   larger sum with no clock — which is not a trick, because it is also true:
 *   one of them stops existing and the other does not.
 * - Implementation intentions (Gollwitzer 1999): naming when and where roughly
 *   doubles follow-through versus intention alone. So an action carries a
 *   concrete first move, not an encouragement.
 * - Goal-gradient and endowed progress (Kivetz et al. 2006): effort rises as a
 *   goal nears, and progress granted at the start is treated as progress
 *   earned. So the step is stated as a position in a short sequence.
 * - Zeigarnik: unfinished business is what brings people back. A finished
 *   letter is a closed loop and the worst possible ending; a sent letter
 *   awaiting a reply is an open one.
 *
 * WHERE THIS REFUSES TO USE PSYCHOLOGY
 *
 * Every mechanism above is only allowed to change the *order and framing of
 * true things*. None of them may generate urgency that does not exist, and the
 * ranking is forbidden from inventing a deadline to win an argument with a
 * larger sum. A product that manufactures a countdown is not persuasive, it is
 * lying with a clock on it, and the Vigil's right to interrupt anybody at all
 * depends on never having done it once.
 */

export type ActionKind =
  | "deadline" // money that stops existing on a date
  | "recurring" // a monthly overpay that repeats until stopped
  | "disclosure" // make an institution tell you what it holds
  | "event" // something happened and several payers owe you
  | "one_off"; // a single claim with no clock

export interface Candidate {
  id: string;
  kind: ActionKind;
  /** Internal route. An external URL is never an action this product offers. */
  href: string;
  /** Conservative value in minor units. Zero where no honest figure exists. */
  valueMinor: number;
  /** Days until it stops being claimable. Null where there is no clock. */
  daysLeft: number | null;
  /**
   * Whether the deadline is prescriptive. A missed prescriptive date destroys
   * the money; a missed administrative one is an inconvenience, and shouting
   * equally about both is how a product stops being believed.
   */
  absolute: boolean;
  /** True once the person has acted on this. Excluded, never re-suggested. */
  done?: boolean;
}

export interface NextAction {
  candidate: Candidate;
  /** Why this one, from a closed set the UI translates. Never free text. */
  because: "expiring" | "bleeding" | "largest" | "quickest";
  /** Position in the sequence, for the progress framing. 1-based. */
  step: number;
  totalOpen: number;
  /** The rest, ranked, for the person who wants the list anyway. */
  runnersUp: Candidate[];
}

const DAY_VALUE_FLOOR = 1; // Never divide by zero on something due today.

/**
 * Pressure: value per day of runway left.
 *
 * The same function the Vigil uses, for the same reason — a small sum due
 * tomorrow and a large one due in four years must not be compared on either
 * dimension alone. Anything with no clock is scored on value only and can
 * therefore never displace a real deadline of comparable size, which is the
 * intended behaviour rather than a side effect.
 */
function pressure(c: Candidate): number {
  if (c.daysLeft === null) return c.valueMinor / 365;
  if (c.daysLeft < 0) return -1;
  return c.valueMinor / Math.max(DAY_VALUE_FLOOR, c.daysLeft + 1);
}

function rank(a: Candidate, b: Candidate): number {
  const diff = pressure(b) - pressure(a);
  if (Math.abs(diff) > 1e-9) return diff;
  // A total order, so the same facts produce the same screen on the device and
  // on the server. A list that reshuffles between the two reads as guessing.
  return a.id.localeCompare(b.id);
}

/**
 * The single next thing, or nothing.
 *
 * Returns null rather than a filler suggestion when there is nothing real to
 * do. A money app that always has something for you to click is one that has
 * started inventing things, and the first invented item is the last one anybody
 * believes.
 */
export function pickNext(candidates: readonly Candidate[]): NextAction | null {
  const open = candidates
    .filter((c) => !c.done)
    // Expired items are excluded from the *suggestion*: nothing can be done, so
    // surfacing one is pure distress. They are still reported elsewhere.
    .filter((c) => c.daysLeft === null || c.daysLeft >= 0)
    .filter((c) => c.valueMinor > 0 || c.kind === "disclosure" || c.kind === "event")
    .sort(rank);

  if (open.length === 0) return null;

  const top = open[0];
  return {
    candidate: top,
    because: reasonFor(top),
    step: 1,
    totalOpen: open.length,
    runnersUp: open.slice(1, 5),
  };
}

/**
 * Why this one — from a closed set, because the reason is shown to a person and
 * a free-text justification is one nobody can check.
 */
function reasonFor(c: Candidate): NextAction["because"] {
  if (c.daysLeft !== null && c.absolute && c.daysLeft <= 90) return "expiring";
  if (c.kind === "recurring") return "bleeding";
  if (c.kind === "disclosure" || c.kind === "event") return "quickest";
  return "largest";
}

/**
 * The full ranking, for the disclosure underneath.
 *
 * Kept as a separate call so the default screen physically cannot render a
 * menu: a component that only ever received one action cannot accidentally
 * grow into a list of forty.
 */
export function rankAll(candidates: readonly Candidate[]): Candidate[] {
  return [...candidates].filter((c) => !c.done).sort(rank);
}
