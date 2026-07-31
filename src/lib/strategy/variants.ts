/**
 * The candidate approaches.
 *
 * Six, not six hundred. The temptation is to let an LLM write a fresh draft
 * every time, but a thousand unique letters produce a thousand buckets of one
 * observation each and nothing is ever learned — the evidence has to land
 * somewhere it can accumulate. So the model still writes the prose; these
 * decide the *stance* it writes in, and the stance is what gets measured.
 *
 * It is also what makes the system explainable. "This claim was filed firmly,
 * citing the statute, with a 14-day deadline, because that combination has been
 * paid 63% of the time by this counterparty across 210 cases" is an answer.
 * "The model felt like it" is not, and will not survive the first regulator who
 * asks why two customers in identical situations were treated differently.
 */

import type { StrategyVariant } from "./types";

export const VARIANTS: readonly StrategyVariant[] = [
  {
    id: "cooperative_plain",
    posture: "cooperative",
    citesStatute: false,
    setsDeadline: false,
    namesEscalation: false,
    anchorsAmount: false,
  },
  {
    id: "cooperative_anchored",
    posture: "cooperative",
    citesStatute: false,
    setsDeadline: true,
    namesEscalation: false,
    anchorsAmount: true,
  },
  {
    id: "firm_statutory",
    posture: "firm",
    citesStatute: true,
    setsDeadline: true,
    namesEscalation: false,
    anchorsAmount: false,
  },
  {
    id: "firm_statutory_anchored",
    posture: "firm",
    citesStatute: true,
    setsDeadline: true,
    namesEscalation: false,
    anchorsAmount: true,
  },
  {
    id: "formal_escalation",
    posture: "formal_legal",
    citesStatute: true,
    setsDeadline: true,
    namesEscalation: true,
    anchorsAmount: false,
  },
  {
    id: "formal_escalation_anchored",
    posture: "formal_legal",
    citesStatute: true,
    setsDeadline: true,
    namesEscalation: true,
    anchorsAmount: true,
  },
];

export function variantById(id: string): StrategyVariant | undefined {
  return VARIANTS.find((v) => v.id === id);
}

/**
 * Display labels for each stance, in both languages the dashboard shows this
 * on. Kept as one map rather than duplicated per caller: it used to exist
 * twice, once bilingual and unused, once Hebrew-only and wired into
 * StrategyInsightsCard — so an English-locale visitor's own dashboard showed
 * a Hebrew fragment ("נחרץ + חוק") with no English variant to fall back to.
 */
export const VARIANT_LABELS: Record<string, { he: string; en: string }> = {
  cooperative_plain: { he: "שיתופי", en: "Cooperative" },
  cooperative_anchored: { he: "שיתופי + סכום", en: "Cooperative + amount" },
  firm_statutory: { he: "נחרץ + חוק", en: "Firm + statute" },
  firm_statutory_anchored: { he: "נחרץ + חוק + סכום", en: "Firm + statute + amount" },
  formal_escalation: { he: "רשמי + הסלמה", en: "Formal escalation" },
  formal_escalation_anchored: { he: "רשמי + הסלמה + סכום", en: "Formal escalation + amount" },
};

export function variantLabel(id: string): { he: string; en: string } {
  return VARIANT_LABELS[id] || { he: id, en: id };
}

/**
 * Turn a stance into instructions for the drafting model. Kept here so the
 * measured dimension and the written instruction can never drift apart — if
 * "firm" quietly starts meaning something else in the prompt, every prior
 * observation labelled "firm" silently becomes a lie about a different letter.
 */
export function describeVariant(v: StrategyVariant): string[] {
  const lines = [
    {
      cooperative: "Write cooperatively: assume good faith and ask for a correction.",
      firm: "Write firmly: state the entitlement as a matter of fact, not a request for a favour.",
      formal_legal:
        "Write formally: the register of a letter before action, precise and unemotional.",
    }[v.posture],
  ];
  if (v.citesStatute) lines.push("Cite the specific statute or regulation the entitlement rests on.");
  if (v.setsDeadline) lines.push("Ask for a substantive reply within 14 days.");
  if (v.namesEscalation) {
    lines.push("State plainly which body the matter goes to if it is refused, without threatening.");
  }
  lines.push(
    v.anchorsAmount
      ? "State the specific amount claimed and how it was calculated."
      : "Ask the recipient to calculate and state the amount due, rather than naming a figure.",
  );
  return lines;
}
