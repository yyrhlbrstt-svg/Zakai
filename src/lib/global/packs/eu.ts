/**
 * European Union — cross-member consumer pack.
 * Used when geo is an EU/EEA country without a dedicated national pack.
 * Letters in English (docLocale en); national packs override when available.
 */

import {
  always,
  any,
  is,
  num,
  oneOf,
  type JurisdictionPack,
  type Predicate,
  type RightCategory,
  type RightDef,
  type PackAction,
} from "../types";

const working = oneOf("employment", "employee", "self_employed");
const parent = num("dependents", { gte: 1 });
const renting = oneOf("housing", "renting");
const disability = is("hasDisability");
const student = oneOf("employment", "student");

const RECIPIENTS: Record<string, string> = {
  trader: "To\n{counterparty}\nCustomer Services / Complaints",
  bank: "To\n{counterparty}\nComplaints / Customer Relations",
  landlord: "To\n{counterparty}",
  dpa: "To\nData Protection Authority\n{municipality}",
  airline: "To\n{counterparty}\nCustomer Relations",
  energy: "To\n{counterparty}\nBilling / Complaints",
};

const IDENTITY = "I am {name}. My reference / ID for this matter is {id}.";

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
    "eu_distance_cancel",
    "consumer",
    always,
    "Directive 2011/83/EU on consumer rights (distance and off-premises contracts) — 14-day withdrawal where applicable",
    { kind: "tool", tool: "/cancel" },
  ),
  right(
    "eu_unfair_terms",
    "consumer",
    always,
    "Council Directive 93/13/EEC on unfair terms in consumer contracts",
    {
      kind: "letter",
      recipient: "trader",
      fields: ["counterparty", "details"],
      subject: "Unfair contract term — request for review and remedy",
      body: `${IDENTITY}\n\nI believe a term in my contract with you is unfair under Directive 93/13/EEC as implemented in my Member State.\n\nPlease review the term described below, confirm your position in writing, and state any remedy you propose:\n\n{details}`,
    },
  ),
  right(
    "eu_flight_261",
    "consumer",
    always,
    "Regulation (EC) No 261/2004 (air passenger rights)",
    { kind: "tool", tool: "/flights" },
  ),
  right(
    "eu_gdpr_access",
    "consumer",
    always,
    "Regulation (EU) 2016/679 (GDPR) Article 15 — right of access",
    {
      kind: "letter",
      recipient: "trader",
      fields: ["counterparty", "details"],
      subject: "Subject access request (GDPR Art. 15)",
      body: `${IDENTITY}\n\nUnder Article 15 GDPR, please provide a copy of my personal data you process and the information listed in Art. 15(1), within one month.\n\nScope / notes: {details}`,
    },
  ),
  right(
    "eu_gdpr_erasure",
    "consumer",
    always,
    "Regulation (EU) 2016/679 (GDPR) Article 17 — right to erasure (where applicable)",
    {
      kind: "letter",
      recipient: "trader",
      fields: ["counterparty", "details"],
      subject: "Erasure request (GDPR Art. 17)",
      body: `${IDENTITY}\n\nI request erasure of my personal data under Article 17 GDPR where one of the grounds in Art. 17(1) applies.\n\nPlease confirm erasure or state a lawful ground for refusal:\n\n{details}`,
    },
  ),
  right(
    "eu_payment_dispute",
    "banking",
    always,
    "Directive (EU) 2015/2366 (PSD2) — unauthorised / incorrect payment transactions",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber", "details"],
      subject: "Payment dispute — account {accountNumber}",
      body: `${IDENTITY}\n\nI dispute the payment(s) described below on account {accountNumber} and ask you to investigate under PSD2 rules as implemented in my Member State, and to refund where required.\n\n{details}`,
    },
  ),
  right(
    "eu_bank_fees",
    "banking",
    always,
    "Directive 2014/92/EU (Payment Accounts Directive) — fee information and switching",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Fee statement and review — account {accountNumber}",
      body: `${IDENTITY}\n\nPlease send a clear breakdown of all fees charged on account {accountNumber} for the last 12 months and confirm whether any were applied incorrectly.`,
    },
  ),
  right(
    "eu_energy_bill",
    "energy",
    always,
    "Directive (EU) 2019/944 (electricity market) — billing transparency and switching rights",
    {
      kind: "letter",
      recipient: "energy",
      fields: ["counterparty", "details"],
      subject: "Energy bill review and credit check",
      body: `${IDENTITY}\n\nPlease review my recent bills for accuracy, confirm any credit balance, and explain how I may switch supplier if I choose.\n\n{details}`,
    },
  ),
  right(
    "eu_deposit_return",
    "housing",
    renting,
    "No EU-harmonized deposit-protection rule exists — tenancy deposits remain Member State competence; enforceable under the relevant national tenancy law",
    {
      kind: "letter",
      recipient: "landlord",
      fields: ["counterparty", "details"],
      subject: "Return of tenancy deposit",
      body: `${IDENTITY}\n\nThe tenancy has ended. Please return my deposit within the period required by local law, or provide an itemised justification for any deduction.\n\n{details}`,
    },
  ),
  right(
    "eu_consumer_credit",
    "banking",
    working,
    "Directive 2008/48/EC on credit agreements for consumers",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber", "details"],
      subject: "Consumer credit — information and redress — {accountNumber}",
      body: `${IDENTITY}\n\nPlease provide the pre-contractual and contractual information required under consumer credit rules for account/agreement {accountNumber}, and address the issue below:\n\n{details}`,
    },
  ),
  right(
    "eu_student_mobility",
    "education",
    student,
    "No EU-harmonized student-finance right exists — student grants/loans remain Member State competence; Erasmus+ mobility grants are EU-administered but this entry is a status-confirmation request, not a legal claim",
    {
      kind: "letter",
      recipient: "trader",
      fields: ["counterparty", "municipality", "details"],
      subject: "Student support — status confirmation",
      body: `${IDENTITY}\n\nPlease confirm the status of my student support / fee arrangement and correct any underpayment.\n\n{details}`,
    },
  ),
  right(
    "eu_disability_access",
    "health",
    disability,
    "Directive (EU) 2019/882 (European Accessibility Act) — accessibility requirements for products and services",
    {
      kind: "letter",
      recipient: "trader",
      fields: ["counterparty", "details"],
      subject: "Accessibility / equal treatment — written response requested",
      body: `${IDENTITY}\n\nI request a written response regarding accessibility or equal treatment in the service described below:\n\n{details}`,
    },
  ),
  right(
    "eu_family_benefits_inquiry",
    "family",
    parent,
    "Coordination of social security systems — Regulation (EC) No 883/2004 (where cross-border) / national family benefits",
    {
      kind: "letter",
      recipient: "trader",
      fields: ["municipality", "details"],
      subject: "Family benefit — entitlement check",
      body: `${IDENTITY}\n\nPlease confirm whether I am receiving the correct family-related benefit(s) and review any period that may have been underpaid.\n\n{details}`,
    },
  ),
];

export const EU_PACK: JurisdictionPack = {
  market: "EU",
  version: "2026.08.3",
  reviewed: "2026-08-03",
  docLocale: "en",
  currency: "EUR",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
