import { providerHebrewName } from "@/lib/providers";

import type { BankFeeKind } from "@/lib/bankFeeLetter";

export type BankProviderKey =
  | "hapoalim"
  | "leumi"
  | "discount"
  | "mizrahi"
  | "fibi"
  | "onezero"
  | "other";

export interface BankOption {
  key: BankProviderKey;
  labelHe: string;
  labelEn: string;
}

/** Selectable IL retail banks — keys align with mandate audience mapping. */
export const IL_BANK_OPTIONS: readonly BankOption[] = [
  { key: "leumi", labelHe: "בנק לאומי", labelEn: "Bank Leumi" },
  { key: "hapoalim", labelHe: "בנק הפועלים", labelEn: "Bank Hapoalim" },
  { key: "discount", labelHe: "בנק דיסקונט / מרכנתיל", labelEn: "Discount / Mercantile" },
  { key: "mizrahi", labelHe: "מזרחי טפחות", labelEn: "Mizrahi-Tefahot" },
  { key: "fibi", labelHe: "הבינלאומי", labelEn: "FIBI" },
  { key: "onezero", labelHe: "ONE ZERO", labelEn: "One Zero" },
  { key: "other", labelHe: "בנק אחר (הקלדה)", labelEn: "Other bank (type name)" },
] as const;

const ALIASES: Record<string, BankProviderKey> = {
  leumi: "leumi",
  "bank leumi": "leumi",
  "bank-leumi": "leumi",
  "בנק לאומי": "leumi",
  לאומי: "leumi",
  hapoalim: "hapoalim",
  "bank hapoalim": "hapoalim",
  "bank-hapoalim": "hapoalim",
  "בנק הפועלים": "hapoalim",
  הפועלים: "hapoalim",
  discount: "discount",
  "בנק דיסקונט": "discount",
  דיסקונט: "discount",
  mercantile: "discount",
  מרכנתיל: "discount",
  mizrahi: "mizrahi",
  "מזרחי טפחות": "mizrahi",
  מזרחי: "mizrahi",
  fibi: "fibi",
  "הבינלאומי": "fibi",
  "first international": "fibi",
  onezero: "onezero",
  "one zero": "onezero",
  "וואן זירו": "onezero",
};

function normalizeKey(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Map free-text or UI key to Case.provider + human-facing bank name for letters.
 */
export function resolveBankProvider(input: {
  bankKey?: string | null;
  bankName?: string | null;
}): { providerKey: string; displayName: string } {
  const rawKey = (input.bankKey || "").trim().toLowerCase();
  if (rawKey && rawKey !== "other" && IL_BANK_OPTIONS.some((b) => b.key === rawKey)) {
    const opt = IL_BANK_OPTIONS.find((b) => b.key === rawKey)!;
    return { providerKey: rawKey, displayName: opt.labelHe };
  }

  const name = (input.bankName || input.bankKey || "").trim();
  if (!name) return { providerKey: "other", displayName: "הבנק" };

  const alias = ALIASES[normalizeKey(name)];
  if (alias && alias !== "other") {
    return { providerKey: alias, displayName: providerHebrewName(alias) };
  }

  return { providerKey: name.slice(0, 80), displayName: name.slice(0, 120) };
}

const FEE_KIND_LABELS: Record<BankFeeKind, { he: string; en: string }> = {
  account_mgmt: { he: "ניהול חשבון / פעולות", en: "Account / activity fee" },
  atm: { he: "כספומט / משיכה", en: "ATM / cash withdrawal" },
  foreign_fx: { he: "המרה / חו״ל", en: "FX / foreign transaction" },
  check: { he: "שיק", en: "Check fee" },
  rejected: { he: "החזרת הוראה", en: "Rejected order / NSF" },
  other: { he: "אחר", en: "Other" },
};

export function bankOptionLabel(key: BankProviderKey, locale: string): string {
  const opt = IL_BANK_OPTIONS.find((b) => b.key === key);
  if (!opt) return key;
  if (locale === "he" || locale === "ar") return opt.labelHe;
  return opt.labelEn;
}

export function feeKindLabel(kind: BankFeeKind, locale: string): string {
  const row = FEE_KIND_LABELS[kind] ?? FEE_KIND_LABELS.other;
  if (locale === "he" || locale === "ar") return row.he;
  return row.en;
}

export const BANK_FEE_KINDS = Object.keys(FEE_KIND_LABELS) as BankFeeKind[];
