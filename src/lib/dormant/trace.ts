/**
 * Turning "I have had a few jobs" into a list of institutions that must answer.
 *
 * THE ONLY HONEST NUMBER IN THIS CATEGORY
 *
 * Every other module here can reason about a market: a typical premium, a
 * statutory credit, a published tariff. A dormant account has none of that. It
 * is nine shekels or ninety thousand, and the distribution is visible only to
 * the institution holding it. So the headline figure is not money — it is the
 * count of bodies under a legal duty to tell you what they are holding.
 *
 * That number is true, checkable, and it is also the one that actually moves
 * people: "eleven institutions have to answer you in writing" is a fact, where
 * "you may be owed thousands" is a guess wearing a suit.
 *
 * WHY THE EMPLOYER COUNT DOES THE HEAVY LIFTING
 *
 * Nobody can name the provident fund their second employer opened for them in
 * 2014. Everybody can say how many jobs they have had. One tap, and it expands
 * into one demand per era — which is the correct shape, because six jobs really
 * are six separate institutions holding six separate balances, not one.
 */

import { IL_DORMANT, type DormantFacts, type DormantSource } from "./sources";

export interface DormantLead {
  source: DormantSource;
  /**
   * Which employment era this lead is about, for the per-employer sources.
   * 1 is the most recent former employer. Null for everything else.
   */
  employerIndex: number | null;
  /** Claiming for yourself, or as an heir. Changes the documents and the letter. */
  as: "self" | "heir";
}

export interface TraceResult {
  leads: DormantLead[];
  /** Distinct institutions under a duty to answer. The headline. */
  institutionCount: number;
  /** Leads that need a grant of probate — grouped because they share paperwork. */
  heirLeads: DormantLead[];
  /** Facts not yet given that would add institutions. Asked after the result. */
  wouldAddMore: string[];
}

/** How many former employers we will expand into separate letters. */
const MAX_EMPLOYER_ERAS = 8;

/**
 * Every institution the facts reach.
 *
 * Order is stable and deterministic: this runs on the device that renders it
 * and on any server that later re-derives it, and a list that reshuffles
 * between the two reads as a product that is guessing.
 */
export function traceDormant(facts: DormantFacts): TraceResult {
  const leads: DormantLead[] = [];
  const eras = Math.min(Math.max(0, Math.floor(facts.pastEmployers ?? 0)), MAX_EMPLOYER_ERAS);

  for (const source of IL_DORMANT) {
    if (!source.applies(facts)) continue;

    // An heir-only source never appears as a claim about the person themselves,
    // and a self-only source is never offered for somebody who has died. Getting
    // this backwards would put a bereaved family in front of the wrong letter.
    const as: DormantLead["as"] = source.claimant === "heir" ? "heir" : "self";

    if (source.perEmployer && eras > 0) {
      for (let i = 1; i <= eras; i++) {
        leads.push({ source, employerIndex: i, as });
      }
      continue;
    }
    leads.push({ source, employerIndex: null, as });
  }

  return {
    leads,
    // Counted per body, not per letter, and deliberately the conservative
    // reading. One former employer's provident fund and pension are frequently
    // run by the same house, so six jobs are six institutions holding possibly
    // two products each — not twelve institutions. The larger number would be
    // the more impressive headline and the less true one, and this is the only
    // number in the module, so it has to be the number we would defend.
    institutionCount:
      new Set(leads.filter((l) => l.employerIndex !== null).map((l) => l.employerIndex)).size +
      new Set(leads.filter((l) => l.employerIndex === null).map((l) => l.source.id)).size,
    heirLeads: leads.filter((l) => l.as === "heir"),
    wouldAddMore: unaskedThatAdd(facts),
  };
}

/**
 * Questions worth asking, after something is already on screen.
 *
 * The order is deliberate: the two at the top each open an entire category on
 * their own, and the rest are refinements. A form that asked all nine upfront
 * would be the intake wall this product exists to remove.
 */
export function unaskedThatAdd(facts: DormantFacts): string[] {
  const out: string[] = [];
  if (facts.pastEmployers === undefined) out.push("pastEmployers");
  if (facts.deceasedRelative === undefined) out.push("deceasedRelative");
  if (facts.changedBank === undefined) out.push("changedBank");
  if (facts.hadStudyFund === undefined) out.push("hadStudyFund");
  if (facts.movedHome === undefined) out.push("movedHome");
  if (facts.heldSecurities === undefined) out.push("heldSecurities");
  if (facts.unreturnedDeposit === undefined) out.push("unreturnedDeposit");
  if (facts.workedAbroad === undefined) out.push("workedAbroad");
  if (facts.preWarFamily === undefined) out.push("preWarFamily");
  return out;
}
