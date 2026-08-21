import { decideClaim, type ClaimCandidate, type ClaimVerdict } from "@/lib/claimGate";
import type { RecurringCharge } from "@/lib/subscriptions";

/**
 * The claim gate applied to the recurring-charge scan.
 *
 * A detected charge and a claim about it are two different things, and the
 * distinction is the whole point of this file.
 *
 *  - The LIST is the person's own statement read back to them. It is not an
 *    assertion, and hiding a row because we are unsure would be its own
 *    betrayal: somebody who knows they pay for that gym, looks for it, and
 *    does not find it has just learned that the scan misses things.
 *  - A CLAIM is Zakai saying "this one — act on this". Pre-selecting it,
 *    naming it the best win, counting it into a call to action. That is an
 *    assertion made before anybody asked, and it goes through the gate.
 *
 * So the list stays whole and the claims get filtered. Below the bar, Zakai
 * shows the row and says nothing about it, which is what silence means on a
 * screen that is also a mirror.
 *
 * Every recurring charge has a real next step — the cancel/negotiate path
 * takes any merchant — so on this surface the gate binds on confidence alone.
 * That is stated rather than hidden, because inventing a missing action path
 * to make the gate look busier would be a lie about our own machinery.
 */
export const SCAN_CLAIM_ACTION = "/money#zakai-money-scan";

export function scanChargeToCandidate(charge: RecurringCharge): ClaimCandidate {
  return {
    kind: "recurring_charge",
    confidence: charge.confidence,
    // Arithmetic over the person's own statement rests on no legal right, and
    // says so rather than borrowing the authority of one it does not use.
    rightId: null,
    actionHref: SCAN_CLAIM_ACTION,
    estimatedValueAgorot: charge.monthlyAgorot,
  };
}

export interface GatedScan {
  /** Charges Zakai is entitled to make a claim about, richest first. */
  claimable: RecurringCharge[];
  /** Shown in the list, never asserted about. */
  heldBack: RecurringCharge[];
  /** The gate's verdicts, kept for counting. */
  verdicts: ClaimVerdict[];
}

/** No right is consulted here, so the verifier is never reached. */
const noRightsInvolved = () => true;

export function gateScanCharges(recurring: readonly RecurringCharge[]): GatedScan {
  const claimable: RecurringCharge[] = [];
  const heldBack: RecurringCharge[] = [];
  const verdicts: ClaimVerdict[] = [];

  for (const charge of recurring) {
    const verdict = decideClaim(scanChargeToCandidate(charge), noRightsInvolved);
    verdicts.push(verdict);
    if (verdict.speak) claimable.push(charge);
    else heldBack.push(charge);
  }

  claimable.sort((a, b) => b.monthlyAgorot - a.monthlyAgorot);
  heldBack.sort((a, b) => b.monthlyAgorot - a.monthlyAgorot);
  return { claimable, heldBack, verdicts };
}
