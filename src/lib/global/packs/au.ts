/**
 * Australia — federal (Commonwealth) rights only, deliberately.
 *
 * Australia splits law between the Commonwealth and six states plus two
 * territories, and tenancy, several consumer-agency addresses, and some
 * energy hardship schemes are state legislation with state regulators. Rather
 * than guess which state a visitor is in or cite eight different tenancy Acts
 * under one right, this pack — its first version — sticks to rights that rest
 * on a single Commonwealth Act and apply identically no matter which state or
 * territory someone lives in. Narrower than the UK pack's breadth on purpose:
 * a smaller pack where every citation is genuinely uniform nationwide beats a
 * larger one that quietly assumes NSW law applies in Western Australia.
 *
 * Every citation below was checked against the actual Act text or the
 * administering agency (ATO / Services Australia / ACCC) before being
 * written here, on 2026-07-30. No AU statutory flight-delay/cancellation
 * compensation right exists as of this review — unlike EU261 in the DE/FR/GB
 * packs — so this pack has no "transport" category right; inventing one
 * would be exactly the fabricated-citation failure this file's own type
 * (`RightDef.source`) exists to make impossible to skip.
 */

import {
  always,
  is,
  num,
  oneOf,
  type JurisdictionPack,
  type Predicate,
  type RightCategory,
  type RightDef,
  type PackAction,
} from "../types";

const employee = oneOf("employment", "employee");
const unemployed = oneOf("employment", "unemployed");
const parent = num("dependents", { gte: 1 });
const newParent = num("dependentsUnder6", { gte: 1 });

const RECIPIENTS: Record<string, string> = {
  ato: "To\nAustralian Taxation Office\nSuperannuation",
  servicesAustralia: "To\nServices Australia",
  employer: "To\n{counterparty}\nPayroll / HR",
  provider: "To\n{counterparty}\nCustomer Service",
};

const IDENTITY = "I am {name}, Tax File Number {id}.";

function right(
  id: string,
  category: RightCategory,
  when: Predicate,
  source: string,
  action: PackAction,
  amounts: { yearlyMinor?: number; oneTimeMinor?: number } = {},
): RightDef {
  return { id, category, when, source, action, ...amounts };
}

const rights: RightDef[] = [
  right(
    "super_guarantee_shortfall",
    "work",
    employee,
    "Superannuation Guarantee (Administration) Act 1992 (Cth)",
    {
      kind: "letter",
      recipient: "employer",
      fields: ["period"],
      subject: "Request for superannuation guarantee payment records — {period}",
      body: `${IDENTITY} I ask you to confirm that superannuation guarantee contributions have been paid in full and on time on my behalf for {period}, and to provide the payment records.

If any shortfall exists, please rectify it immediately. If it is not rectified, I will report the matter to the Australian Taxation Office, which administers compliance under this Act.`,
    },
  ),
  right(
    "lost_unclaimed_super",
    "banking",
    always,
    "Superannuation (Unclaimed Money and Lost Members) Act 1999 (Cth)",
    {
      kind: "letter",
      recipient: "ato",
      subject: "Search for lost or unclaimed superannuation held on my behalf",
      body: `${IDENTITY} Please confirm whether any superannuation is held in my name as lost member money or unclaimed money under this Act, from any fund, and provide the steps to have it paid or rolled over to my current account.`,
    },
  ),
  right(
    "consumer_guarantee_remedy",
    "consumer",
    always,
    "Australian Consumer Law (Schedule 2, Competition and Consumer Act 2010 (Cth)), s. 54",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty", "details"],
      subject: "Request for remedy under the Australian Consumer Law",
      body: `${IDENTITY} Goods or services I bought from you do not meet the consumer guarantees under the Australian Consumer Law: {details}.

Please provide a repair, replacement or refund as required by these guarantees, and confirm your response in writing.`,
    },
  ),
  right(
    "unsolicited_agreement_coolingoff",
    "consumer",
    always,
    "Australian Consumer Law (Schedule 2, Competition and Consumer Act 2010 (Cth)), Div 2 of Part 3-2 (unsolicited consumer agreements)",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["details"],
      subject: "Cancellation of an unsolicited consumer agreement",
      body: `${IDENTITY} I am cancelling the agreement made following unsolicited contact: {details}.

Under the unsolicited consumer agreement provisions of the Australian Consumer Law I am entitled to a 10-business-day cooling-off period (extended where the contact rules were not followed), and I ask you to confirm the cancellation and refund any amount paid.`,
    },
  ),
  right(
    "family_tax_benefit",
    "family",
    parent,
    "A New Tax System (Family Assistance) Act 1999 (Cth)",
    {
      kind: "letter",
      recipient: "servicesAustralia",
      subject: "Family Tax Benefit — entitlement and review",
      body: `${IDENTITY} Please confirm my current Family Tax Benefit entitlement and review whether any period has been underpaid or wrongly assessed.`,
    },
  ),
  right(
    "paid_parental_leave",
    "family",
    newParent,
    "Paid Parental Leave Act 2010 (Cth)",
    {
      kind: "letter",
      recipient: "servicesAustralia",
      subject: "Parental Leave Pay — entitlement check",
      body: `${IDENTITY} Please confirm my entitlement to Parental Leave Pay for my child, including the number of days available and whether any has already been paid.`,
    },
    // Verified national headline rate, current at this pack's review date:
    // $1,004.70/week for 26 weeks from 1 July 2026 (Paid Parental Leave
    // scheme, Services Australia). $1,004.70 * 26 = $26,122.20 AUD.
    { oneTimeMinor: 2_612_220 },
  ),
  right(
    "jobseeker_payment",
    "social_security",
    unemployed,
    "Social Security Act 1991 (Cth), Part 2.12",
    {
      kind: "letter",
      recipient: "servicesAustralia",
      subject: "JobSeeker Payment — claim and assessment review",
      body: `${IDENTITY} Please confirm the status of my JobSeeker Payment claim and review my assessed rate for correctness.`,
    },
  ),
  right("recurring_charges_scan", "consumer", always, "Contract cancellation", {
    kind: "tool",
    tool: "/scan",
  }),
];

export const AU_PACK: JurisdictionPack = {
  market: "AU",
  version: "2026.07.1",
  reviewed: "2026-07-30",
  docLocale: "en-AU",
  currency: "AUD",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
