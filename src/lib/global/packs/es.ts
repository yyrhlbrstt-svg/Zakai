/**
 * Spain — Seguridad Social / AEAT / consumo. Letters in Spanish.
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
  seguridad: "Dirección Provincial de la Seguridad Social\n{municipality}",
  hacienda: "Agencia Tributaria\n{municipality}",
  bank: "Atención al cliente — {counterparty}",
  provider: "Servicio de atención — {counterparty}",
  arrendador: "{counterparty}",
};

const IDENTITY = "D./Dña. {name}, DNI/NIE {id}.";

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
    "es_imv",
    "social_security",
    lowIncome,
    "Real Decreto 20/2020 — Ingreso Mínimo Vital",
    {
      kind: "letter",
      recipient: "seguridad",
      fields: ["municipality"],
      subject: "Ingreso Mínimo Vital — revisión del derecho",
      body: `${IDENTITY}\n\nSolicito la revisión de mi derecho al Ingreso Mínimo Vital y el abono de cantidades pendientes.`,
    },
  ),
  right(
    "es_desempleo",
    "social_security",
    unemployed,
    "Real Decreto Legislativo 8/2015 — prestación por desempleo",
    {
      kind: "letter",
      recipient: "seguridad",
      fields: ["municipality"],
      subject: "Prestación por desempleo — estado y recálculo",
      body: `${IDENTITY}\n\nSolicito confirmación del estado de mi prestación por desempleo y recálculo si la cuantía es incorrecta.`,
    },
  ),
  right(
    "es_pension",
    "senior",
    senior,
    "Ley General de la Seguridad Social — jubilación",
    {
      kind: "letter",
      recipient: "seguridad",
      fields: ["municipality"],
      subject: "Pensión de jubilación — revisión",
      body: `${IDENTITY}\n\nSolicito revisión de mi pensión de jubilación y abono de atrasos debidos.`,
    },
  ),
  right(
    "es_discapacidad",
    "social_security",
    disability,
    "Ley General de la Seguridad Social — incapacidad permanente",
    {
      kind: "letter",
      recipient: "seguridad",
      fields: ["municipality"],
      subject: "Prestación por incapacidad — revisión",
      body: `${IDENTITY}\n\nSolicito información sobre mi reconocimiento de incapacidad y el pago correcto de la prestación.`,
    },
  ),
  right(
    "es_bono_social",
    "consumer",
    lowIncome,
    "Real Decreto 897/2017 — bono social eléctrico",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty", "accountNumber"],
      subject: "Bono social eléctrico — solicitud / revisión",
      body: `${IDENTITY}\n\nSolicito la aplicación o revisión del bono social en el contrato {accountNumber}.`,
    },
  ),
  right(
    "es_alquiler_ayuda",
    "housing",
    any(renting, lowIncome),
    "Ley 12/2023 — ayudas al alquiler (régimen estatal)",
    {
      kind: "letter",
      recipient: "hacienda",
      fields: ["municipality", "period"],
      subject: "Ayuda al alquiler — {period}",
      body: `${IDENTITY}\n\nSolicito el reconocimiento de la ayuda al alquiler correspondiente a {period}.`,
    },
  ),
  right(
    "es_fianza",
    "housing",
    renting,
    "Ley de Arrendamientos Urbanos — fianza",
    {
      kind: "letter",
      recipient: "arrendador",
      fields: ["counterparty", "details"],
      subject: "Devolución de fianza",
      body: `${IDENTITY}\n\nFinalizado el arrendamiento, solicito la devolución de la fianza en plazo legal.\n\n{details}`,
    },
  ),
  right(
    "es_becas",
    "education",
    student,
    "Real Decreto 1721/2007 — becas y ayudas al estudio",
    {
      kind: "letter",
      recipient: "hacienda",
      fields: ["municipality"],
      subject: "Beca / ayuda al estudio — revisión",
      body: `${IDENTITY}\n\nSolicito revisión de mi solicitud de beca y abono de importes concedidos pendientes.`,
    },
  ),
  right(
    "es_comisiones_banco",
    "banking",
    always,
    "Ley 7/1998 — transparencia y comisiones bancarias",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Reclamación de comisiones — cuenta {accountNumber}",
      body: `${IDENTITY}\n\nSolicito detalle de comisiones en la cuenta {accountNumber} y devolución de cargos indebidos.`,
    },
  ),
  right("es_vuelo", "consumer", always, "Reglamento (CE) nº 261/2004", {
    kind: "tool",
    tool: "/flights",
  }),
  right("es_suscripciones", "consumer", always, "Ley General para la Defensa de los Consumidores", {
    kind: "tool",
    tool: "/cancel",
  }),
];

export const ES_PACK: JurisdictionPack = {
  market: "ES",
  version: "2026.08.1",
  reviewed: "2026-08-02",
  docLocale: "es-ES",
  currency: "EUR",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
