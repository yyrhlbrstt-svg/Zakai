/**
 * France — EU pack deepened 2026.07.3. Data-only; letters in French.
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
const employee = oneOf("employment", "employee");
const parent = num("dependents", { gte: 1 });
const lowIncome = oneOf("incomeBand", "low");
const renting = oneOf("housing", "renting");
const owner = oneOf("housing", "owner");
const disability = is("hasDisability");
const student = oneOf("employment", "student");

const RECIPIENTS: Record<string, string> = {
  impot: "Service des impôts des particuliers\n{municipality}",
  caf: "Caisse d'Allocations Familiales\n{municipality}",
  bank: "Réclamations — {counterparty}",
  provider: "Service client — {counterparty}",
  landlord: "{counterparty}",
  cpam: "CPAM — {municipality}",
  employeur: "Service paie / RH — {counterparty}",
  energie: "Service facturation — {counterparty}",
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
  right("ir_regularisation", "tax", working, "CGI — impôt sur le revenu", {
    kind: "letter",
    recipient: "impot",
    fields: ["period", "municipality"],
    subject: "Demande de vérification / remboursement d'impôt — {period}",
    body: `${IDENTITY}\n\nJe demande la vérification de mon imposition pour la période {period} et le remboursement de tout trop-perçu.`,
  }),
  right("caf_droits", "family", any(parent, lowIncome), "Code de la sécurité sociale — prestations CAF", {
    kind: "letter",
    recipient: "caf",
    fields: ["municipality"],
    subject: "Demande d'étude de droits CAF",
    body: `${IDENTITY}\n\nJe sollicite l'étude de mes droits aux prestations (allocations, APL le cas échéant) et le versement des rappels dus.`,
  }),
  right("prime_activite", "social_security", any(working, lowIncome), "Code de la sécurité sociale — prime d'activité", {
    kind: "letter",
    recipient: "caf",
    fields: ["municipality"],
    subject: "Prime d'activité — étude de droits",
    body: `${IDENTITY}\n\nJe demande l'étude de mon droit à la prime d'activité et le versement des rappels éventuels.`,
  }),
  right("frais_bancaires", "banking", always, "Code monétaire et financier — contestation de frais", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "Contestation de frais bancaires — compte {accountNumber}",
    body: `${IDENTITY}\n\nJe demande le détail des frais prélevés sur le compte {accountNumber} et le remboursement des frais contestables.`,
  }),
  right("energie_regularisation", "energy", always, "Code de l'énergie — facturation", {
    kind: "letter",
    recipient: "energie",
    fields: ["counterparty", "accountNumber"],
    subject: "Régularisation et remboursement — contrat {accountNumber}",
    body: `${IDENTITY}\n\nMerci de vérifier les factures du contrat {accountNumber} et de rembourser tout trop-perçu.`,
  }),
  right("depot_garantie", "housing", renting, "Loi du 6 juillet 1989 — dépôt de garantie", {
    kind: "letter",
    recipient: "landlord",
    fields: ["counterparty", "details"],
    subject: "Restitution du dépôt de garantie",
    body: `${IDENTITY}\n\nLe bail est terminé. Je demande la restitution du dépôt de garantie sous le délai légal.\n\n{details}`,
  }),
  right("sante_remboursement", "health", any(working, senior, disability), "Assurance maladie — remboursements", {
    kind: "letter",
    recipient: "cpam",
    fields: ["municipality"],
    subject: "Demande de vérification de remboursements",
    body: `${IDENTITY}\n\nJe demande la vérification des remboursements en attente et le versement des sommes dues.`,
  }),
  right("heures_sup", "work", employee, "Code du travail — heures supplémentaires", {
    kind: "letter",
    recipient: "employeur",
    fields: ["counterparty", "period"],
    subject: "Demande de régularisation des heures supplémentaires — {period}",
    body: `${IDENTITY}\n\nJe demande le détail des heures effectuées sur {period} et le paiement des heures supplémentaires dues.`,
  }),
  right("retraite_releve", "social_security", num("ageYears", { gte: 45 }), "Code de la sécurité sociale — retraite", {
    kind: "letter",
    recipient: "cpam",
    fields: ["municipality"],
    subject: "Relevé de carrière et droits à retraite",
    body: `${IDENTITY}\n\nJe demande mon relevé de carrière complet et l'identification des trimestres manquants.`,
  }),
  right("taxe_fonciere", "municipal", owner, "CGI — taxe foncière", {
    kind: "letter",
    recipient: "impot",
    fields: ["municipality", "period"],
    subject: "Contestation / dégrèvement taxe foncière — {period}",
    body: `${IDENTITY}\n\nJe conteste le montant de la taxe foncière pour {period} et demande un dégrèvement le cas échéant.`,
  }),
  right("bourse_etudiant", "social_security", student, "CROUS / bourses sur critères sociaux", {
    kind: "letter",
    recipient: "caf",
    fields: ["municipality"],
    subject: "Bourse étudiante — étude de droits",
    body: `${IDENTITY}\n\nJe sollicite l'étude de mon droit à bourse sur critères sociaux et le versement des rappels dus.`,
  }),
  right("vol_eu261", "consumer", always, "Règlement (CE) n° 261/2004", {
    kind: "tool",
    tool: "/flights",
  }),
  right("abonnements", "consumer", always, "Code de la consommation — résiliation", {
    kind: "tool",
    tool: "/scan",
  }),
  right("frais_bancaires_outil", "banking", always, "Code monétaire — frais", {
    kind: "tool",
    tool: "/bank-fees",
  }),
];

export const FR_PACK: JurisdictionPack = {
  market: "FR",
  version: "2026.07.3",
  reviewed: "2026-07-28",
  docLocale: "fr-FR",
  currency: "EUR",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
