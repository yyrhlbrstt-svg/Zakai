/** Japan — consumer / bank / deposit letters. Japanese. */
import {
  always,
  any,
  num,
  oneOf,
  type JurisdictionPack,
  type Predicate,
  type RightCategory,
  type RightDef,
  type PackAction,
} from "../types";

const renting = oneOf("housing", "renting");
const working = oneOf("employment", "employee", "self_employed");
const senior = any(num("ageYears", { gte: 65 }), oneOf("employment", "retired"));

const RECIPIENTS: Record<string, string> = {
  bank: "{counterparty}\nお客さま相談室",
  trader: "{counterparty}\nお客様相談窓口",
  landlord: "{counterparty}",
  nenkin: "日本年金機構\n{municipality}",
};

const IDENTITY = "私は{name}です。照会番号 / 基礎年金番号（下桁）は{id}です。";

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
  right("jp_cancel", "consumer", always, "特定商取引法 / 消費者契約法 — クーリング・オフ及び解約", {
    kind: "tool",
    tool: "/cancel",
  }),
  right("jp_bank_fees", "banking", always, "銀行法 / 金融庁事務ガイドライン — 手数料の説明請求", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "口座手数料の明細請求（{accountNumber}）",
    body: `${IDENTITY}\n\n口座{accountNumber}の過去12か月の手数料明細を開示し、誤った引落しがあれば返還してください。`,
  }),
  right("jp_deposit", "housing", renting, "民法第622条の2 — 敷金返還請求権", {
    kind: "letter",
    recipient: "landlord",
    fields: ["counterparty", "details"],
    subject: "敷金の返還請求",
    body: `${IDENTITY}\n\n賃貸借契約は終了しました。敷金の返還、または控除の内訳を文書で示してください。\n\n{details}`,
  }),
  right("jp_nenkin", "senior", senior, "国民年金法 / 厚生年金保険法 — 年金記録確認", {
    kind: "letter",
    recipient: "nenkin",
    fields: ["municipality"],
    subject: "年金記録・支給額の確認",
    body: `${IDENTITY}\n\n年金記録と支給額を確認し、不足があれば精算してください。`,
  }),
  right("jp_wage", "work", working, "労働基準法 — 賃金明細・未払賃金", {
    kind: "letter",
    recipient: "trader",
    fields: ["counterparty", "details"],
    subject: "賃金・明細の確認請求",
    body: `${IDENTITY}\n\n下記事項について賃金明細の開示と是正を求めます。\n\n{details}`,
  }),
  right("jp_warranty", "consumer", always, "民法第562条〜第564条（契約不適合責任）／ 消費者契約法", {
    kind: "tool",
    tool: "/warranty",
  }),
];

export const JP_PACK: JurisdictionPack = {
  market: "JP",
  version: "2026.08.3",
  reviewed: "2026-08-03",
  docLocale: "ja-JP",
  currency: "JPY",
  minorUnits: 1,
  recipients: RECIPIENTS,
  rights,
};
