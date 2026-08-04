/**
 * Poland — ZUS / gov.pl programs. Letters in Polish.
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

const senior = any(num("ageYears", { gte: 65 }), oneOf("employment", "retired"));
const working = oneOf("employment", "employee", "self_employed");
const employee = oneOf("employment", "employee");
const parent = num("dependents", { gte: 1 });
const lowIncome = oneOf("incomeBand", "low");
const renting = oneOf("housing", "renting");
const disability = is("hasDisability");
const student = oneOf("employment", "student");
const unemployed = oneOf("employment", "unemployed");

const RECIPIENTS: Record<string, string> = {
  zus: "Zakład Ubezpieczeń Społecznych\n{municipality}",
  urzad: "Urząd Skarbowy\n{municipality}",
  bank: "Dział reklamacji — {counterparty}",
  provider: "Obsługa klienta — {counterparty}",
  wynajmujacy: "{counterparty}",
};

const IDENTITY = "Ja, {name}, PESEL {id}.";

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
    "pl_rodzina_800",
    "family",
    parent,
    "Ustawa z dnia 11 lutego 2016 r. — program Rodzina 800+",
    {
      kind: "letter",
      recipient: "zus",
      fields: ["municipality"],
      subject: "Świadczenie wychowawcze — weryfikacja wypłat",
      body: `${IDENTITY}\n\nProszę o weryfikację wypłat świadczenia wychowawczego za wszystkie uprawnione dzieci.`,
    },
  ),
  right(
    "pl_zasilek_bezrobotny",
    "social_security",
    unemployed,
    "Ustawa z dnia 20 kwietnia 2004 r. — zasiłek dla bezrobotnych",
    {
      kind: "letter",
      recipient: "zus",
      fields: ["municipality"],
      subject: "Zasiłek dla bezrobotnych — status",
      body: `${IDENTITY}\n\nProszę o potwierdzenie statusu zasiłku i przeliczenie, jeśli kwota jest błędna.`,
    },
  ),
  right(
    "pl_emerytura",
    "senior",
    senior,
    "Ustawa z dnia 17 grudnia 1998 r. — emerytury i renty",
    {
      kind: "letter",
      recipient: "zus",
      fields: ["municipality"],
      subject: "Emerytura — weryfikacja świadczenia",
      body: `${IDENTITY}\n\nProszę o weryfikację wysokości emerytury i wypłatę zaległości.`,
    },
  ),
  right(
    "pl_dodatek_mieszkaniowy",
    "housing",
    any(renting, lowIncome),
    "Ustawa z dnia 21 czerwca 2001 r. — dodatek mieszkaniowy",
    {
      kind: "letter",
      recipient: "zus",
      fields: ["municipality"],
      subject: "Dodatek mieszkaniowy — wniosek",
      body: `${IDENTITY}\n\nProszę o rozpatrzenie prawa do dodatku mieszkaniowego i wypłatę należności.`,
    },
  ),
  right(
    "pl_swiadczenie_pielegnacyjne",
    "social_security",
    disability,
    "Ustawa z dnia 28 listopada 2003 r. — świadczenie pielęgnacyjne",
    {
      kind: "letter",
      recipient: "zus",
      fields: ["municipality"],
      subject: "Świadczenie pielęgnacyjne — decyzja",
      body: `${IDENTITY}\n\nProszę o informację o decyzji w sprawie świadczenia pielęgnacyjnego i prawidłowej wypłacie.`,
    },
  ),
  right(
    "pl_stypendium",
    "education",
    student,
    "Ustawa z dnia 20 lipca 2018 r. — studia i stypendia",
    {
      kind: "letter",
      recipient: "zus",
      fields: ["municipality"],
      subject: "Stypendium — weryfikacja",
      body: `${IDENTITY}\n\nProszę o weryfikację stypendium i wypłatę przyznanych środków.`,
    },
  ),
  right(
    "pl_kaucja",
    "housing",
    renting,
    "Ustawa z dnia 21 czerwca 2001 r. o ochronie praw lokatorów, mieszkaniowym zasobie gminy i o zmianie Kodeksu cywilnego, art. 6",
    {
      kind: "letter",
      recipient: "wynajmujacy",
      fields: ["counterparty", "details"],
      subject: "Zwrot kaucji",
      body: `${IDENTITY}\n\nUmowa najmu wygasła. Proszę o zwrot kaucji w ustawowym terminie.\n\n{details}`,
    },
  ),
  right(
    "pl_bank_oplaty",
    "banking",
    always,
    "Ustawa z dnia 19 sierpnia 2011 r. — opłaty bankowe",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Opłaty bankowe — rachunek {accountNumber}",
      body: `${IDENTITY}\n\nProszę o wykaz opłat na rachunku {accountNumber} i zwrot nieuzasadnionych obciążeń.`,
    },
  ),
  right(
    "pl_dodatek_oslonowy",
    "consumer",
    lowIncome,
    "Ustawa z dnia 17 grudnia 2021 r. o dodatku osłonowym",
    {
      kind: "letter",
      recipient: "zus",
      fields: ["municipality"],
      subject: "Dodatek osłonowy — wniosek",
      body: `${IDENTITY}\n\nProszę o rozpatrzenie prawa do dodatku osłonowego i wypłatę należności.`,
    },
  ),
  right("pl_lot", "consumer", always, "Rozporządzenie (WE) nr 261/2004", {
    kind: "tool",
    tool: "/flights",
  }),
  right("pl_subskrypcje", "consumer", always, "Ustawa o prawach konsumenta — odstąpienie", {
    kind: "tool",
    tool: "/cancel",
  }),
];

export const PL_PACK: JurisdictionPack = {
  market: "PL",
  version: "2026.08.1",
  reviewed: "2026-08-02",
  docLocale: "pl-PL",
  currency: "PLN",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
