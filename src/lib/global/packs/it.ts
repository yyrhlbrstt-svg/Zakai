/**
 * Italy — INPS / Agenzia delle Entrate. Letters in Italian.
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
  inps: "INPS — {municipality}",
  agenzia: "Agenzia delle Entrate — {municipality}",
  bank: "Reclami — {counterparty}",
  provider: "Servizio clienti — {counterparty}",
  locatore: "{counterparty}",
};

const IDENTITY = "Il/La sottoscritto/a {name}, codice fiscale {id}.";

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
    "it_assegno_unico",
    "family",
    parent,
    "Decreto Legislativo 154/2021 — assegno unico universale",
    {
      kind: "letter",
      recipient: "inps",
      fields: ["municipality"],
      subject: "Assegno unico — verifica e arretrati",
      body: `${IDENTITY}\n\nChiedo verifica del mio diritto all'assegno unico e il pagamento di eventuali arretrati.`,
    },
  ),
  right(
    "it_naspi",
    "social_security",
    unemployed,
    "Decreto Legislativo 148/2015 — NASpI",
    {
      kind: "letter",
      recipient: "inps",
      fields: ["municipality"],
      subject: "NASpI — stato della domanda",
      body: `${IDENTITY}\n\nChiedo conferma dello stato della mia NASpI e ricalcolo se l'importo è errato.`,
    },
  ),
  right(
    "it_pensione",
    "senior",
    senior,
    "Legge 9 marzo 1989, n. 88 — pensione",
    {
      kind: "letter",
      recipient: "inps",
      fields: ["municipality"],
      subject: "Pensione — verifica importo",
      body: `${IDENTITY}\n\nChiedo verifica del mio trattamento pensionistico e pagamento di somme dovute.`,
    },
  ),
  right(
    "it_inclusione",
    "social_security",
    lowIncome,
    "Decreto Legislativo 147/2017 — reddito di inclusione / SFL",
    {
      kind: "letter",
      recipient: "inps",
      fields: ["municipality"],
      subject: "Misura di inclusione — riesame",
      body: `${IDENTITY}\n\nChiedo riesame del mio diritto alla misura di inclusione attiva e pagamento degli arretrati.`,
    },
  ),
  right(
    "it_invalidita",
    "social_security",
    disability,
    "Legge 12 giugno 1984, n. 222 — invalidità civile",
    {
      kind: "letter",
      recipient: "inps",
      fields: ["municipality"],
      subject: "Invalidità — accertamento e importi",
      body: `${IDENTITY}\n\nChiedo informazioni sull'accertamento di invalidità e sul corretto pagamento della prestazione.`,
    },
  ),
  right(
    "it_bonus_sociale",
    "consumer",
    lowIncome,
    "Delibera ARERA — bonus sociale luce/gas",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty", "accountNumber"],
      subject: "Bonus sociale — utenza {accountNumber}",
      body: `${IDENTITY}\n\nChiedo applicazione o revisione del bonus sociale sulla fornitura {accountNumber}.`,
    },
  ),
  right(
    "it_affitto",
    "housing",
    any(renting, lowIncome),
    "Legge 431/1998 — canone concordato / sostegno affitto",
    {
      kind: "letter",
      recipient: "agenzia",
      fields: ["municipality"],
      subject: "Contributo affitto — domanda",
      body: `${IDENTITY}\n\nChiedo riconoscimento del contributo per il canone di locazione secondo la normativa vigente.`,
    },
  ),
  right(
    "it_deposito",
    "housing",
    renting,
    "Articolo 11 L. 392/1978 — cauzione",
    {
      kind: "letter",
      recipient: "locatore",
      fields: ["counterparty", "details"],
      subject: "Restituzione cauzione",
      body: `${IDENTITY}\n\nIl contratto è cessato. Chiedo restituzione della cauzione nei termini di legge.\n\n{details}`,
    },
  ),
  right(
    "it_borse",
    "education",
    student,
    "Legge 390/1991 — diritto allo studio",
    {
      kind: "letter",
      recipient: "inps",
      fields: ["municipality"],
      subject: "Borsa di studio — verifica",
      body: `${IDENTITY}\n\nChiedo verifica della mia borsa di studio e pagamento di importi spettanti.`,
    },
  ),
  right(
    "it_commissioni_banca",
    "banking",
    always,
    "Testo unico bancario — trasparenza commissioni",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Commissioni bancarie — conto {accountNumber}",
      body: `${IDENTITY}\n\nChiedo dettaglio delle commissioni sul conto {accountNumber} e rimborso di addebiti indebiti.`,
    },
  ),
  right("it_volo", "consumer", always, "Regolamento (CE) n. 261/2004", {
    kind: "tool",
    tool: "/flights",
  }),
  right("it_abbonamenti", "consumer", always, "Codice del consumo — recesso", {
    kind: "tool",
    tool: "/cancel",
  }),
];

export const IT_PACK: JurisdictionPack = {
  market: "IT",
  version: "2026.08.1",
  reviewed: "2026-08-02",
  docLocale: "it-IT",
  currency: "EUR",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
