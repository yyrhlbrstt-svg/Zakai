/** Canada — data-only pack (conservative templates). */

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
const senior = any(num("ageYears", { gte: 65 }), oneOf("employment", "retired"));

const RECIPIENTS: Record<string, string> = {
  cra: "Canada Revenue Agency\n{municipality}",
  bank: "Complaints — {counterparty}",
  landlord: "{counterparty}",
  provider: "Customer service — {counterparty}",
};

const IDENTITY = "I, {name}, reference {id}.";

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
  right("tax_review", "tax", working, "Income Tax Act — CRA", {
    kind: "letter",
    recipient: "cra",
    fields: ["period"],
    subject: "Request for review / refund — {period}",
    body: `${IDENTITY}\n\nPlease review my tax position for {period} and refund any overpayment.`,
  }),
  right("bank_fees", "banking", always, "FCAC — bank fee complaints", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "Fee dispute — account {accountNumber}",
    body: `${IDENTITY}\n\nPlease itemise and reverse unjustified fees on account {accountNumber}.`,
  }),
  right("deposit_return", "housing", renting, "Provincial tenancy law", {
    kind: "letter",
    recipient: "landlord",
    fields: ["counterparty", "details"],
    subject: "Return of security deposit",
    body: `${IDENTITY}\n\nThe tenancy has ended. Please return the deposit within the statutory period.\n\n{details}`,
  }),
  right("energy_bill", "energy", always, "Provincial utility rules", {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty", "accountNumber"],
    subject: "Bill review — {accountNumber}",
    body: `${IDENTITY}\n\nPlease review charges on contract {accountNumber} and refund any overbilling.`,
  }),
  right("benefits_check", "family", any(parent, senior), "Government of Canada benefits", {
    kind: "tool",
    tool: "/what-am-i-owed",
  }),
  right("subs", "consumer", always, "Contract cancellation", { kind: "tool", tool: "/scan" }),
];

export const CA_PACK: JurisdictionPack = {
  market: "CA",
  version: "2026.07.1",
  reviewed: "2026-07-27",
  docLocale: "en-CA",
  currency: "CAD",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
