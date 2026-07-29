/**
 * Every category, reduced to one comparable list.
 *
 * This is where the five engines stop being five products. Each one knows how
 * to find its own money and none of them can rank against the others, because
 * an entitlement worth ₪2,400 a year, a captive premium bleeding ₪90 a month
 * and a disclosure demand with no figure at all are not the same kind of
 * object. Somebody has to flatten them, and that somebody must be one function
 * with the flattening rules written down, or the ordering becomes an accident
 * of which component rendered first.
 *
 * The rule for the categories with no honest figure is the interesting one.
 * A dormant account cannot be valued, so valuing it at zero would bury it
 * forever, and valuing it at a guess would be the fabrication the whole product
 * refuses. It carries zero and is admitted on its kind instead — a disclosure
 * demand competes on being nearly free to do, not on a number nobody has.
 */

import { evaluateRights, type RightsProfile } from "../rights";
import { summariseWatch } from "../vigil/watch";
import { captiveFor } from "../captive/products";
import { traceDormant } from "../dormant/trace";
import type { Candidate } from "./pick";

export interface CollectInput {
  profile: RightsProfile;
  /** Right ids the person has already acted on. */
  actedOn?: readonly string[];
  now?: Date;
}

/**
 * Conservative annual value of a right, in minor units.
 *
 * A right with no quantified value is admitted at zero rather than dropped: it
 * is still real, it simply cannot outrank something measured. Dropping it would
 * silently delete entitlements whose worth depends on facts we do not hold.
 */
function valueOf(r: { yearlyAgorot?: number; oneTimeAgorot?: number }): number {
  return Math.max(0, r.yearlyAgorot ?? 0) + Math.max(0, r.oneTimeAgorot ?? 0);
}

export function collectCandidates(input: CollectInput): Candidate[] {
  const { profile } = input;
  const acted = new Set(input.actedOn ?? []);
  const out: Candidate[] = [];

  const rights = evaluateRights(profile);
  const eligible = rights.matches.map((e) => ({
    id: e.id,
    yearlyMinor: e.yearlyAgorot,
    oneTimeMinor: e.oneTimeAgorot,
  }));

  // Deadlines first, from the Vigil, which already knows which rights have a
  // statutory clock and when it started. Taking its countdowns rather than
  // recomputing them is what keeps the countdown on this screen identical to
  // the one in the notification.
  const watch = summariseWatch({
    profile,
    eligible,
    actedOn: input.actedOn,
    now: input.now,
  });
  const onClock = new Set<string>();
  for (const item of watch.items) {
    if (item.urgency === "expired") continue;
    onClock.add(item.rightId);
    out.push({
      id: item.taxYear ? `${item.rightId}:${item.taxYear}` : item.rightId,
      kind: "deadline",
      href: "/score",
      valueMinor: item.valueAtRiskMinor,
      daysLeft: item.daysLeft,
      absolute: item.absolute,
      done: acted.has(item.rightId),
    });
  }

  // Entitlements with no clock. Excluded where the Vigil already produced a
  // countdown for the same right, or the person would see it twice with two
  // different framings and trust neither.
  for (const r of rights.matches) {
    if (onClock.has(r.id) || acted.has(r.id)) continue;
    out.push({
      id: r.id,
      kind: "one_off",
      href: "/score",
      valueMinor: valueOf(r),
      daysLeft: null,
      absolute: false,
    });
  }

  // Captive pricing. No value is attached because the estimate needs a figure
  // only the person has; it earns its place on being recurring, which the
  // ranker treats as its own reason rather than as a number.
  const captive = captiveFor({
    hasMortgage: profile.hasMortgage,
    hasCarLoan: profile.hasCarLoan,
    employed: profile.employment === "employee" || profile.employment === "self_employed",
    spendsForeignCurrency: profile.spendsForeignCurrency,
    holdsSecurities: profile.holdsSecurities,
  });
  for (const p of captive) {
    out.push({
      id: `captive:${p.id}`,
      kind: "recurring",
      href: "/score",
      // A monthly overpay compounds, so it must not sit at the bottom for
      // want of a figure. It is admitted on kind, and the ranker's `bleeding`
      // reason is what the person is shown instead of a fabricated amount.
      valueMinor: 0,
      daysLeft: null,
      absolute: false,
    });
  }

  const dormant = traceDormant({
    pastEmployers: profile.pastEmployers,
    heldSecurities: profile.holdsSecurities,
  });
  if (dormant.institutionCount > 0) {
    out.push({
      id: "dormant",
      kind: "disclosure",
      href: "/dormant",
      valueMinor: 0,
      daysLeft: null,
      absolute: false,
    });
  }

  return out;
}
