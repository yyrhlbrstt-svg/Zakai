/**
 * International / rest-of-world pack (ISO user-assigned code XX).
 * Baseline Mandate → letter → proof path for countries without a national pack.
 * No invented amounts. Citations are global instruments or in-app tools only.
 */

import {
  always,
  oneOf,
  type JurisdictionPack,
  type Predicate,
  type RightCategory,
  type RightDef,
  type PackAction,
} from "../types";

const renting = oneOf("housing", "renting");

const RECIPIENTS: Record<string, string> = {
  trader: "To\n{counterparty}\nCustomer Services / Complaints",
  bank: "To\n{counterparty}\nComplaints / Customer Relations",
  landlord: "To\n{counterparty}",
  airline: "To\n{counterparty}\nCustomer Relations",
};

const IDENTITY = "I am {name}. My reference for this matter is {id}.";

function right(
  id: string,
  category: RightCategory,
  when: Predicate,
  source: string,
  action: PackAction,
): RightDef {
  return { id, category, when, source, action };
}

const rights: RightDef[] = [
  right(
    "xx_subscription_cancel",
    "consumer",
    always,
    "United Nations Guidelines for Consumer Protection (2015) — access to redress; local distance-selling / consumer contract rules where enacted",
    { kind: "tool", tool: "/cancel" },
  ),
  right(
    "xx_refund_chase",
    "consumer",
    always,
    "United Nations Guidelines for Consumer Protection (2015) — effective redress for defective goods/services; local consumer-protection law where enacted",
    { kind: "tool", tool: "/refund-chase" },
  ),
  right(
    "xx_flight_delay",
    "consumer",
    always,
    "Convention for the Unification of Certain Rules for International Carriage by Air (Montreal Convention, 1999), where applicable to the itinerary",
    { kind: "tool", tool: "/flights" },
  ),
  right(
    "xx_bank_fees",
    "banking",
    always,
    "Local banking / consumer protection law — fee transparency and dispute of unauthorised charges (jurisdiction-specific; letter requests records only)",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber", "details"],
      subject: "Account fee and charge review — {accountNumber}",
      body: `${IDENTITY}\n\nPlease provide a full breakdown of fees and charges on account {accountNumber} for the last 12 months, and reverse any charge that was unauthorised or applied in error under applicable law.\n\n{details}`,
    },
  ),
  right(
    "xx_unauthorised_payment",
    "banking",
    always,
    "Local payment-services / electronic-funds-transfer consumer protections (jurisdiction-specific)",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber", "details"],
      subject: "Unauthorised or incorrect payment — account {accountNumber}",
      body: `${IDENTITY}\n\nI dispute the payment(s) below on account {accountNumber}. Please investigate under applicable payment rules and refund where required.\n\n{details}`,
    },
  ),
  right(
    "xx_data_access",
    "consumer",
    always,
    "OECD Privacy Guidelines / local data-protection or privacy statute — right to access personal data where enacted",
    {
      kind: "letter",
      recipient: "trader",
      fields: ["counterparty", "details"],
      subject: "Request for access to my personal data",
      body: `${IDENTITY}\n\nPlease provide a copy of the personal data you hold about me and explain the purposes of processing, under applicable privacy / data-protection law.\n\n{details}`,
    },
  ),
  right(
    "xx_deposit_return",
    "housing",
    renting,
    "Local residential tenancy law — return of security deposit at end of tenancy (jurisdiction-specific; no universal rule)",
    {
      kind: "letter",
      recipient: "landlord",
      fields: ["counterparty", "details"],
      subject: "Return of security deposit",
      body: `${IDENTITY}\n\nThe tenancy has ended. Please return my security deposit within the time required by local law, or provide an itemised list of lawful deductions.\n\n{details}`,
    },
  ),
  right(
    "xx_warranty",
    "consumer",
    always,
    "United Nations Guidelines for Consumer Protection (2015) — warranties and after-sales; local sale-of-goods rules",
    { kind: "tool", tool: "/warranty" },
  ),
  right(
    "xx_money_scan",
    "consumer",
    always,
    "Product tool — recurring-charge detection (no statutory amount claimed until documented)",
    { kind: "tool", tool: "/money" },
  ),
  right(
    "xx_what_owed_local",
    "consumer",
    always,
    "Invite to contribute a national pack — docs/COUNTRY_PACKS.md — until then use letters/tools above",
    { kind: "tool", tool: "/global" },
  ),
];

export const XX_PACK: JurisdictionPack = {
  market: "XX",
  version: "2026.08.3",
  reviewed: "2026-08-03",
  docLocale: "en",
  currency: "USD",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
