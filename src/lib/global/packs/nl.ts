/**
 * Netherlands — Belastingdienst / UWV / SVB. Letters in Dutch (docLocale).
 * Checked against primary legislation names on 2026-08-02; means-tested amounts omitted.
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

const senior = any(num("ageYears", { gte: 67 }), oneOf("employment", "retired"));
const working = oneOf("employment", "employee", "self_employed");
const employee = oneOf("employment", "employee");
const parent = num("dependents", { gte: 1 });
const lowIncome = oneOf("incomeBand", "low");
const renting = oneOf("housing", "renting");
const disability = is("hasDisability");
const student = oneOf("employment", "student");
const unemployed = oneOf("employment", "unemployed");

const RECIPIENTS: Record<string, string> = {
  belastingdienst: "Belastingdienst\n{municipality}",
  uwv: "UWV\nKlantenservice",
  bank: "Klachten — {counterparty}",
  provider: "Klantenservice — {counterparty}",
  verhuurder: "{counterparty}",
};

const IDENTITY = "Ik, {name}, BSN {id}.";

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
    "nl_zorgtoeslag",
    "health",
    lowIncome,
    "Wet op de zorgtoeslag (Zorgtoeslag)",
    {
      kind: "letter",
      recipient: "belastingdienst",
      fields: ["municipality", "period"],
      subject: "Zorgtoeslag — controle en nabetaal {period}",
      body: `${IDENTITY}\n\nIk verzoek controle van mijn recht op zorgtoeslag over {period} en uitbetaling van eventueel te veel ingehouden eigen bijdrage.`,
    },
  ),
  right(
    "nl_huurtoeslag",
    "housing",
    any(renting, lowIncome),
    "Wet op de huurtoeslag (Huurtoeslag)",
    {
      kind: "letter",
      recipient: "belastingdienst",
      fields: ["municipality"],
      subject: "Huurtoeslag — beoordeling recht",
      body: `${IDENTITY}\n\nIk verzoek beoordeling van mijn huurtoeslag en uitbetaling van achterstallige toeslag.`,
    },
  ),
  right(
    "nl_kinderbijslag",
    "family",
    parent,
    "Algemene Kinderbijslagwet (Kinderbijslag)",
    {
      kind: "letter",
      recipient: "belastingdienst",
      fields: ["municipality"],
      subject: "Kinderbijslag — controle uitkering",
      body: `${IDENTITY}\n\nIk verzoek controle of kinderbijslag volledig en tijdig is uitbetaald voor al mijn kinderen.`,
    },
  ),
  right(
    "nl_ww_aanvraag",
    "social_security",
    unemployed,
    "Werkloosheidswet (WW-uitkering)",
    {
      kind: "letter",
      recipient: "uwv",
      subject: "WW-uitkering — status en herberekening",
      body: `${IDENTITY}\n\nIk verzoek bevestiging van mijn WW-uitkering en herberekening indien de hoogte onjuist is vastgesteld.`,
    },
  ),
  right(
    "nl_bijstand",
    "social_security",
    lowIncome,
    "Participatiewet (bijstand)",
    {
      kind: "letter",
      recipient: "belastingdienst",
      fields: ["municipality"],
      subject: "Bijstand — herbeoordeling recht",
      body: `${IDENTITY}\n\nIk verzoek herbeoordeling van mijn bijstandsrecht en uitbetaling van achterstallige bedragen.`,
    },
  ),
  right(
    "nl_wia",
    "social_security",
    disability,
    "Wet werk en inkomen naar arbeidsvermogen (WIA)",
    {
      kind: "letter",
      recipient: "uwv",
      subject: "WIA — beoordeling en uitkering",
      body: `${IDENTITY}\n\nIk verzoek informatie over mijn WIA-beoordeling en correcte uitbetaling van de uitkering.`,
    },
  ),
  right(
    "nl_bank_kosten",
    "banking",
    always,
    "Wet op het financieel toezicht — bankkosten (AFM/DNB klachtenroute)",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Terugvordering bankkosten — rekening {accountNumber}",
      body: `${IDENTITY}\n\nIk verzoek specificatie van alle kosten op rekening {accountNumber} en terugbetaling van onterecht in rekening gebrachte kosten.`,
    },
  ),
  right(
    "nl_huur_borg",
    "housing",
    renting,
    "Burgerlijk Wetboek Boek 7 — huur en waarborgsom",
    {
      kind: "letter",
      recipient: "verhuurder",
      fields: ["counterparty", "details"],
      subject: "Teruggave waarborgsom",
      body: `${IDENTITY}\n\nDe huur is beëindigd. Ik verzoek teruggave van de waarborgsom binnen de wettelijke termijn.\n\n{details}`,
    },
  ),
  right(
    "nl_studiefinanciering",
    "education",
    student,
    "Wet studiefinanciering 2000 (DUO)",
    {
      kind: "letter",
      recipient: "belastingdienst",
      fields: ["municipality"],
      subject: "Studiefinanciering — controle recht",
      body: `${IDENTITY}\n\nIk verzoek controle van mijn studiefinanciering en uitbetaling van eventueel openstaande bedragen.`,
    },
  ),
  right("nl_vlucht_comp", "consumer", always, "Verordening (EG) nr. 261/2004", {
    kind: "tool",
    tool: "/flights",
  }),
  right("nl_abonnementen", "consumer", always, "Consumentenrecht — opzegging", {
    kind: "tool",
    tool: "/cancel",
  }),
  right("nl_bank_tool", "banking", always, "Bankkosten — in-app agent", {
    kind: "tool",
    tool: "/bank-fees",
  }),
];

export const NL_PACK: JurisdictionPack = {
  market: "NL",
  version: "2026.08.1",
  reviewed: "2026-08-02",
  docLocale: "nl-NL",
  currency: "EUR",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
