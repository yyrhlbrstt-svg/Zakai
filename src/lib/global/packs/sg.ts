/** Singapore — CASE / CPF / bank letters. English. */
import {
  always,
  any,
  num,
  oneOf,
  type JurisdictionPack,
  type Predicate,
  type RightCategory,
  type RightDef,
  type PackAction,
} from "../types";

const working = oneOf("employment", "employee", "self_employed");
const renting = oneOf("housing", "renting");
const senior = any(num("ageYears", { gte: 65 }), oneOf("employment", "retired"));

const RECIPIENTS: Record<string, string> = {
  cpf: "Central Provident Fund Board\n{municipality}",
  bank: "{counterparty}\nCustomer Service",
  trader: "{counterparty}\nCustomer Service",
  landlord: "{counterparty}",
};

const IDENTITY = "I am {name}. My NRIC / FIN reference (last four) is {id}.";

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
  right("sg_cpf_statement", "work", working, "Central Provident Fund Act 1953 — account statement and corrections", {
    kind: "letter",
    recipient: "cpf",
    fields: ["municipality", "details"],
    subject: "CPF account — statement and correction",
    body: `${IDENTITY}\n\nPlease provide my CPF statement and correct any contribution errors.\n\n{details}`,
  }),
  right("sg_cancel", "consumer", always, "Consumer Protection (Fair Trading) Act 2003 — unfair practices / cancellation", {
    kind: "tool",
    tool: "/cancel",
  }),
  right("sg_bank_fees", "banking", always, "Banking Act / MAS fair dealing — fee disputes", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "Account fees — {accountNumber}",
    body: `${IDENTITY}\n\nPlease provide a fee breakdown for account {accountNumber} and reverse incorrect charges.`,
  }),
  right("sg_deposit", "housing", renting, "Residential tenancy practice / contract — security deposit return", {
    kind: "letter",
    recipient: "landlord",
    fields: ["counterparty", "details"],
    subject: "Return of security deposit",
    body: `${IDENTITY}\n\nThe tenancy has ended. Please return my deposit or itemise lawful deductions.\n\n{details}`,
  }),
  right("sg_cpf_retirement", "senior", senior, "Central Provident Fund Act — retirement-related withdrawals / payouts", {
    kind: "letter",
    recipient: "cpf",
    fields: ["municipality"],
    subject: "CPF retirement payout — status",
    body: `${IDENTITY}\n\nPlease confirm my CPF retirement-related payout status and any amounts due.`,
  }),
];

export const SG_PACK: JurisdictionPack = {
  market: "SG",
  version: "2026.08.3",
  reviewed: "2026-08-03",
  docLocale: "en-SG",
  currency: "SGD",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
