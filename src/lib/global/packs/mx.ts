/** Mexico — PROFECO / IMSS / bank letters. Spanish. */
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

const parent = num("dependents", { gte: 1 });
const renting = oneOf("housing", "renting");
const lowIncome = oneOf("incomeBand", "low");
const disability = is("hasDisability");
const senior = any(num("ageYears", { gte: 65 }), oneOf("employment", "retired"));

const RECIPIENTS: Record<string, string> = {
  imss: "Instituto Mexicano del Seguro Social\n{municipality}",
  banco: "{counterparty}\nUNE / Atención a clientes",
  proveedor: "{counterparty}\nAtención a clientes",
  arrendador: "{counterparty}",
  // Federal family/welfare programs are run by the Secretaría de Bienestar,
  // not IMSS (which only administers employment-linked social security).
  bienestar: "Secretaría de Bienestar\n{municipality}",
};

const IDENTITY = "Soy {name}. Mi CURP / referencia es {id}.";

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
  right("mx_pensiones", "senior", senior, "Ley del Seguro Social — pensiones IMSS", {
    kind: "letter",
    recipient: "imss",
    fields: ["municipality"],
    subject: "Pensión — revisión de pago",
    body: `${IDENTITY}\n\nSolicito revisión de mi pensión y pago de diferencias adeudadas.`,
  }),
  right("mx_incapacidad", "social_security", disability, "Ley del Seguro Social — incapacidad / invalidez", {
    kind: "letter",
    recipient: "imss",
    fields: ["municipality", "details"],
    subject: "Prestación por incapacidad — revisión",
    body: `${IDENTITY}\n\nSolicito información y revisión de mi prestación.\n\n{details}`,
  }),
  right("mx_profeco_cancel", "consumer", always, "Ley Federal de Protección al Consumidor — cancelación y reclamaciones", {
    kind: "tool",
    tool: "/cancel",
  }),
  right("mx_comisiones", "banking", always, "Ley para la Transparencia y Ordenamiento de los Servicios Financieros — comisiones", {
    kind: "letter",
    recipient: "banco",
    fields: ["counterparty", "accountNumber"],
    subject: "Comisiones de la cuenta {accountNumber}",
    body: `${IDENTITY}\n\nSolicito desglose de comisiones de la cuenta {accountNumber} y devolución de cargos indebidos.`,
  }),
  right("mx_deposito", "housing", renting, "Código Civil local / contrato de arrendamiento — depósito en garantía", {
    kind: "letter",
    recipient: "arrendador",
    fields: ["counterparty", "details"],
    subject: "Devolución de depósito en garantía",
    body: `${IDENTITY}\n\nEl arrendamiento terminó. Solicito la devolución del depósito o el desglose legal de retenciones.\n\n{details}`,
  }),
  right("mx_familia", "family", any(parent, lowIncome), "Ley General de Desarrollo Social — Programas para el Bienestar (Secretaría de Bienestar)", {
    kind: "letter",
    recipient: "bienestar",
    fields: ["municipality", "details"],
    subject: "Apoyo familiar — verificación",
    body: `${IDENTITY}\n\nSolicito verificación de apoyos familiares aplicables.\n\n{details}`,
  }),
  right("mx_garantia", "consumer", always, "LFPC — garantías y productos defectuosos", {
    kind: "tool",
    tool: "/warranty",
  }),
];

export const MX_PACK: JurisdictionPack = {
  market: "MX",
  version: "2026.08.3",
  reviewed: "2026-08-03",
  docLocale: "es-MX",
  currency: "MXN",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
