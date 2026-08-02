/**
 * Sweden — Försäkringskassan / CSN / Pensionsmyndigheten. Letters in Swedish.
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
  forsakring: "Försäkringskassan\n{municipality}",
  bank: "Kundservice — {counterparty}",
  provider: "Kundservice — {counterparty}",
  hyresvard: "{counterparty}",
};

const IDENTITY = "Jag, {name}, personnummer {id}.";

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
    "se_barnbidrag",
    "family",
    parent,
    "Socialförsäkringsbalken — barnbidrag",
    {
      kind: "letter",
      recipient: "forsakring",
      fields: ["municipality"],
      subject: "Barnbidrag — kontroll av utbetalning",
      body: `${IDENTITY}\n\nJag begär kontroll att barnbidrag betalats fullt ut för alla mina barn.`,
    },
  ),
  right(
    "se_akassa",
    "social_security",
    unemployed,
    "Lagen (1997:238) om arbetslöshetsförsäkring",
    {
      kind: "letter",
      recipient: "forsakring",
      fields: ["municipality"],
      subject: "Arbetslöshetsersättning — omprövning",
      body: `${IDENTITY}\n\nJag begär status på min arbetslöshetsersättning och omprövning om beloppet är felaktigt.`,
    },
  ),
  right(
    "se_garantipension",
    "senior",
    senior,
    "Socialförsäkringsbalken — garantipension",
    {
      kind: "letter",
      recipient: "forsakring",
      fields: ["municipality"],
      subject: "Garantipension — kontroll",
      body: `${IDENTITY}\n\nJag begär kontroll av min garantipension och utbetalning av eventuella rester.`,
    },
  ),
  right(
    "se_bostadsbidrag",
    "housing",
    any(renting, lowIncome),
    "Socialförsäkringsbalken — bostadsbidrag",
    {
      kind: "letter",
      recipient: "forsakring",
      fields: ["municipality"],
      subject: "Bostadsbidrag — ansökan / omprövning",
      body: `${IDENTITY}\n\nJag begär prövning av bostadsbidrag och utbetalning av efterskott.`,
    },
  ),
  right(
    "se_sjukersattning",
    "social_security",
    disability,
    "Socialförsäkringsbalken — sjukersättning",
    {
      kind: "letter",
      recipient: "forsakring",
      fields: ["municipality"],
      subject: "Sjukersättning — beslut och belopp",
      body: `${IDENTITY}\n\nJag begär information om mitt beslut om sjukersättning och korrekt utbetalning.`,
    },
  ),
  right(
    "se_forsorjningsstod",
    "social_security",
    lowIncome,
    "Socialtjänstlagen (2001:453) — försörjningsstöd",
    {
      kind: "letter",
      recipient: "forsakring",
      fields: ["municipality"],
      subject: "Försörjningsstöd — omprövning",
      body: `${IDENTITY}\n\nJag begär omprövning av försörjningsstöd och utbetalning av bristande belopp.`,
    },
  ),
  right(
    "se_studiemedel",
    "education",
    student,
    "Studiestödslagen (1999:1395) — CSN",
    {
      kind: "letter",
      recipient: "forsakring",
      fields: ["municipality"],
      subject: "Studiemedel — kontroll",
      body: `${IDENTITY}\n\nJag begär kontroll av studiemedel och utbetalning av beviljade belopp.`,
    },
  ),
  right(
    "se_hyresdeposit",
    "housing",
    renting,
    "Jordabalken 12 kap. — deposition",
    {
      kind: "letter",
      recipient: "hyresvard",
      fields: ["counterparty", "details"],
      subject: "Återbetalning av deposition",
      body: `${IDENTITY}\n\nHyresavtalet har upphört. Jag begär återbetalning av deposition inom skälig tid.\n\n{details}`,
    },
  ),
  right(
    "se_bankavgifter",
    "banking",
    always,
    "Konsumentkreditlagen — bankavgifter",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Bankavgifter — konto {accountNumber}",
      body: `${IDENTITY}\n\nJag begär specifikation av avgifter på konto {accountNumber} och återbetalning av felaktiga debiteringar.`,
    },
  ),
  right("se_flyg", "consumer", always, "Förordning (EG) nr 261/2004", {
    kind: "tool",
    tool: "/flights",
  }),
  right("se_prenumerationer", "consumer", always, "Distansavtalslagen — uppsägning", {
    kind: "tool",
    tool: "/cancel",
  }),
];

export const SE_PACK: JurisdictionPack = {
  market: "SE",
  version: "2026.08.1",
  reviewed: "2026-08-02",
  docLocale: "sv-SE",
  currency: "SEK",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
