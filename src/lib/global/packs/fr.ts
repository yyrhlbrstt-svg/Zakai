/**
 * France — EU pack (data-only). Amounts conservative; letters in French.
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

const senior = any(num("ageYears", { gte: 62 }), oneOf("employment", "retired"));
const working = oneOf("employment", "employee", "self_employed");
const parent = num("dependents", { gte: 1 });
const lowIncome = oneOf("incomeBand", "low");
const renting = oneOf("housing", "renting");
const disability = is("hasDisability");

const RECIPIENTS: Record<string, string> = {
  impot: "Service des impôts des particuliers\n{municipality}",
  caf: "Caisse d'Allocations Familiales\n{municipality}",
  bank: "Réclamations — {counterparty}",
  provider: "Service client — {counterparty}",
  landlord: "{counterparty}",
  cpam: "CPAM — {municipality}",
};

const IDENTITY = "Je soussigné(e) {name}, référence {id}.";

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
    "ir_regularisation",
    "tax",
    working,
    "CGI — impôt sur le revenu",
    {
      kind: "letter",
      recipient: "impot",
      fields: ["period", "municipality"],
      subject: "Demande de vérification / remboursement d'impôt — {period}",
      body: `${IDENTITY}\n\nJe demande la vérification de mon imposition pour la période {period} et le remboursement de tout trop-perçu.`,
    },
  ),
  right(
    "caf_droits",
    "family",
    any(parent, lowIncome),
    "Code de la sécurité sociale — prestations CAF",
    {
      kind: "letter",
      recipient: "caf",
      fields: ["municipality"],
      subject: "Demande d'étude de droits CAF",
      body: `${IDENTITY}\n\nJe sollicite l'étude de mes droits aux prestations (allocations, APL le cas échéant) et le versement des rappels dus.`,
    },
  ),
  right(
    "frais_bancaires",
    "banking",
    always,
    "Code monétaire et financier — contestation de frais",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Contestation de frais bancaires — compte {accountNumber}",
      body: `${IDENTITY}\n\nJe demande le détail des frais prélevés sur le compte {accountNumber} et le remboursement des frais contestables.`,
    },
  ),
  right(
    "energie_regularisation",
    "energy",
    always,
    "Code de l'énergie — facturation",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty", "accountNumber"],
      subject: "Régularisation et remboursement — contrat {accountNumber}",
      body: `${IDENTITY}\n\nMerci de vérifier les factures du contrat {accountNumber} et de rembourser tout trop-perçu.`,
    },
  ),
  right(
    "depot_garantie",
    "housing",
    renting,
    "Loi du 6 juillet 1989 — dépôt de garantie",
    {
      kind: "letter",
      recipient: "landlord",
      fields: ["counterparty", "details"],
      subject: "Restitution du dépôt de garantie",
      body: `${IDENTITY}\n\nLe bail est terminé. Je demande la restitution du dépôt de garantie sous le délai légal.\n\n{details}`,
    },
  ),
  right(
    "sante_remboursement",
    "health",
    any(working, senior, disability),
    "Assurance maladie — remboursements",
    {
      kind: "letter",
      recipient: "cpam",
      fields: ["municipality"],
      subject: "Demande de vérification de remboursements",
      body: `${IDENTITY}\n\nJe demande la vérification des remboursements en attente et le versement des sommes dues.`,
    },
  ),
  right(
    "vol_eu261",
    "consumer",
    always,
    "Règlement (CE) n° 261/2004",
    { kind: "tool", tool: "/flights" },
  ),
  right(
    "abonnements",
    "consumer",
    always,
    "Code de la consommation — résiliation",
    { kind: "tool", tool: "/scan" },
  ),
];

export const FR_PACK: JurisdictionPack = {
  market: "FR",
  version: "2026.07.1",
  reviewed: "2026-07-27",
  docLocale: "fr-FR",
  currency: "EUR",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
