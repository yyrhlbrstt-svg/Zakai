/**
 * Germany — EU foothold pack (deepened 2026.07.3).
 * Data only; engine unchanged. Amounts conservative / unquantified where
 * means-tested. Letters in German (docLocale de-DE).
 */

import {
  all,
  always,
  any,
  is,
  not,
  num,
  oneOf,
  type JurisdictionPack,
  type Predicate,
  type RightCategory,
  type RightDef,
  type PackAction,
} from "../types";

const senior = any(num("ageYears", { gte: 66 }), oneOf("employment", "retired"));
const employee = oneOf("employment", "employee");
const working = oneOf("employment", "employee", "self_employed");
const parent = num("dependents", { gte: 1 });
const lowIncome = oneOf("incomeBand", "low");
const renting = oneOf("housing", "renting");
const owner = oneOf("housing", "owner");
const disability = is("hasDisability");
const student = oneOf("employment", "student");

const RECIPIENTS: Record<string, string> = {
  finanzamt: "An das Finanzamt\n{municipality}",
  jobcenter: "An das Jobcenter\n{municipality}",
  rentenversicherung: "Deutsche Rentenversicherung Bund",
  bank: "An {counterparty}\nKundenbeschwerden",
  provider: "An {counterparty}\nKundenservice",
  vermieter: "An {counterparty}",
  krankenkasse: "An {counterparty}\nMitglieder-Service",
  arbeitgeber: "An {counterparty}\nPersonalabteilung",
  energie: "An {counterparty}\nKundenservice",
};

const IDENTITY = "Ich bin {name}, Steueridentifikationsnummer / Referenz {id}.";

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
  right("lohnsteuer_jahresausgleich", "tax", working, "EStG — Veranlagung / Lohnsteuerermäßigung", {
    kind: "letter",
    recipient: "finanzamt",
    fields: ["period", "municipality"],
    subject: "Antrag auf Überprüfung der Lohnsteuer / Erstattung — {period}",
    body: `${IDENTITY} Ich bitte um Prüfung meiner Lohnsteuer für den Zeitraum {period} und um Erstattung etwaiger Überzahlungen.\n\nBitte teilen Sie mir mit, welche Unterlagen noch benötigt werden.`,
  }),
  right("kindergeld_check", "family", parent, "BKGG / EStG Kindergeld", {
    kind: "letter",
    recipient: "finanzamt",
    fields: ["municipality"],
    subject: "Kindergeld — Überprüfung des Anspruchs",
    body: `${IDENTITY} Bitte prüfen Sie meinen Kindergeld-Anspruch und ob Nachzahlungen für offene Zeiträume bestehen.`,
  }),
  right("elterngeld_check", "family", parent, "BEEG — Elterngeld", {
    kind: "letter",
    recipient: "jobcenter",
    fields: ["municipality"],
    subject: "Elterngeld — Überprüfung und Nachzahlung",
    body: `${IDENTITY} Bitte prüfen Sie meinen Elterngeld-Anspruch und etwaige Nachzahlungen für offene Zeiträume.`,
  }),
  right("grundsicherung_check", "social_security", any(lowIncome, all(senior, lowIncome)), "SGB II / SGB XII", {
    kind: "letter",
    recipient: "jobcenter",
    fields: ["municipality"],
    subject: "Überprüfung möglicher Ansprüche auf Grundsicherungsleistungen",
    body: `${IDENTITY} Bitte prüfen Sie, ob mir Leistungen nach SGB II oder SGB XII zustehen, und teilen Sie mir die erforderlichen Nachweise mit.`,
  }),
  right("rentenauskunft", "social_security", num("ageYears", { gte: 45 }), "SGB VI", {
    kind: "letter",
    recipient: "rentenversicherung",
    subject: "Antrag auf Renteninformation und Kontenklärung",
    body: `${IDENTITY} Bitte senden Sie mir eine aktuelle Renteninformation und prüfen Sie, ob Lücken in meinem Versicherungskonto bestehen.`,
  }),
  right("bankentgelte_pruefung", "banking", always, "BGB / AGB-Banken — unwirksame Entgeltklauseln (BGH)", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "Einsicht und Erstattung unberechtigter Kontoentgelte — {accountNumber}",
    body: `${IDENTITY} Bitte übersenden Sie eine Aufstellung aller Kontoentgelte der letzten Jahre zu Konto {accountNumber} und erstatten Sie Entgelte, die nach der Rechtsprechung unwirksam sind.`,
  }),
  right("strom_gas_abrechnung", "energy", always, "EnWG — Abrechnungs- und Guthabenansprüche", {
    kind: "letter",
    recipient: "energie",
    fields: ["counterparty", "accountNumber"],
    subject: "Abrechnungsprüfung und Auszahlung von Guthaben — {accountNumber}",
    body: `${IDENTITY} Bitte prüfen Sie die Abrechnungen zu Vertrag {accountNumber} und zahlen Sie bestehendes Guthaben aus.`,
  }),
  right("kaution_rueckzahlung", "housing", renting, "BGB § 551 — Mietkaution", {
    kind: "letter",
    recipient: "vermieter",
    fields: ["counterparty", "details"],
    subject: "Rückzahlung der Mietkaution",
    body: `${IDENTITY} Das Mietverhältnis ist beendet. Bitte zahlen Sie die Kaution zurück bzw. legen Sie eine nachvollziehbare Abrechnung vor.\n\n{details}`,
  }),
  right("pflege_kranken_beitrag", "health", any(working, senior, disability), "SGB V — Beitrags- und Erstattungsfragen", {
    kind: "letter",
    recipient: "krankenkasse",
    fields: ["counterparty"],
    subject: "Überprüfung von Beiträgen und möglichen Erstattungen",
    body: `${IDENTITY} Bitte prüfen Sie mein Beitragskonto auf Überzahlungen und offene Erstattungsansprüche.`,
  }),
  right("urlaubsentgelt", "work", employee, "BUrlG / Entgeltfortzahlung", {
    kind: "letter",
    recipient: "arbeitgeber",
    fields: ["counterparty", "period"],
    subject: "Überprüfung von Urlaubsentgelt und Abzügen — {period}",
    body: `${IDENTITY} Bitte legen Sie die Berechnung meines Urlaubsentgelts für {period} offen und korrigieren Sie Unterzahlungen.`,
  }),
  right("wohngebaeude_versicherung", "housing", owner, "VVG — Wohngebäude / Hausrat", {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty", "accountNumber"],
    subject: "Prämien- und Leistungssüberprüfung — Vertrag {accountNumber}",
    body: `${IDENTITY} Bitte prüfen Sie Prämie und Deckungsumfang des Vertrags {accountNumber} und erstatten Sie zu Unrecht erhobene Beträge.`,
  }),
  right("bafog_check", "social_security", student, "BAföG", {
    kind: "letter",
    recipient: "jobcenter",
    fields: ["municipality"],
    subject: "BAföG — Überprüfung des Anspruchs",
    body: `${IDENTITY} Bitte prüfen Sie meinen BAföG-Anspruch und etwaige Nachzahlungen.`,
  }),
  right("flug_eu261", "consumer", always, "Verordnung (EG) Nr. 261/2004", {
    kind: "tool",
    tool: "/flights",
  }),
  right("abo_audit", "consumer", always, "BGB Widerruf / Kündigung von Dauerschuldverhältnissen", {
    kind: "tool",
    tool: "/scan",
  }),
  right("bank_fees_tool", "banking", always, "BGB — unberechtigte Entgelte", {
    kind: "tool",
    tool: "/bank-fees",
  }),
];

export const DE_PACK: JurisdictionPack = {
  market: "DE",
  version: "2026.07.3",
  reviewed: "2026-07-28",
  docLocale: "de-DE",
  currency: "EUR",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
