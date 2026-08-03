/** Brazil — CDC / INSS / bank letters. Portuguese. */
import {
  all,
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
const working = oneOf("employment", "employee", "self_employed");

const RECIPIENTS: Record<string, string> = {
  inss: "Instituto Nacional do Seguro Social — INSS\n{municipality}",
  banco: "{counterparty}\nOuvidoria / SAC",
  fornecedor: "{counterparty}\nSAC / Ouvidoria",
  locador: "{counterparty}",
};

const IDENTITY = "Eu, {name}, CPF {id}.";

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
  right("br_bolsa_familia", "family", any(parent, lowIncome), "Lei nº 14.601/2023 — Programa Bolsa Família", {
    kind: "letter",
    recipient: "inss",
    fields: ["municipality"],
    subject: "Bolsa Família — revisão de benefício",
    body: `${IDENTITY}\n\nSolicito revisão do meu benefício Bolsa Família e pagamento de valores eventualmente devidos.`,
  }),
  right("br_bpc", "social_security", any(disability, all(senior, lowIncome)), "Lei Orgânica da Assistência Social — BPC/LOAS", {
    kind: "letter",
    recipient: "inss",
    fields: ["municipality", "details"],
    subject: "BPC/LOAS — revisão",
    body: `${IDENTITY}\n\nSolicito informações e revisão do BPC/LOAS.\n\n{details}`,
  }),
  right("br_inss_aposentadoria", "senior", senior, "Lei nº 8.213/1991 — benefícios previdenciários", {
    kind: "letter",
    recipient: "inss",
    fields: ["municipality"],
    subject: "Benefício INSS — conferência",
    body: `${IDENTITY}\n\nSolicito conferência do meu benefício previdenciário e pagamento de diferenças.`,
  }),
  right("br_cdc_cancelamento", "consumer", always, "Código de Defesa do Consumidor (Lei nº 8.078/1990) — direito de arrependimento / cancelamento", {
    kind: "tool",
    tool: "/cancel",
  }),
  right("br_tarifas_bancarias", "banking", always, "CDC / normas do Banco Central — tarifas", {
    kind: "letter",
    recipient: "banco",
    fields: ["counterparty", "accountNumber"],
    subject: "Tarifas da conta {accountNumber}",
    body: `${IDENTITY}\n\nSolicito extrato de tarifas da conta {accountNumber} e estorno de cobranças indevidas.`,
  }),
  right("br_trabalho", "work", working, "CLT — verbas e comprovantes", {
    kind: "letter",
    recipient: "fornecedor",
    fields: ["counterparty", "details"],
    subject: "Documentação trabalhista / verbas",
    body: `${IDENTITY}\n\nSolicito documentação e esclarecimentos sobre verbas descritas abaixo.\n\n{details}`,
  }),
  right("br_caucao", "housing", renting, "Lei do Inquilinato (Lei nº 8.245/1991) — caução", {
    kind: "letter",
    recipient: "locador",
    fields: ["counterparty", "details"],
    subject: "Devolução de caução",
    body: `${IDENTITY}\n\nO contrato encerrou. Solicito devolução da caução ou discriminação legal das retenções.\n\n{details}`,
  }),
];

export const BR_PACK: JurisdictionPack = {
  market: "BR",
  version: "2026.08.3",
  reviewed: "2026-08-03",
  docLocale: "pt-BR",
  currency: "BRL",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
