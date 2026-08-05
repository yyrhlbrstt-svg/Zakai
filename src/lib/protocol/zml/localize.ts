import type { ZmlRight } from "./types";

const BCP47_TO_ZML: Record<string, string> = {
  he: "he",
  "he-IL": "he",
  ar: "he",
  en: "en",
  "en-US": "en",
  "en-GB": "en",
  ru: "ru",
};

/** Pick a human-facing label from ZML display_name for UI and catalog?locale=. */
export function resolveZmlDisplayName(right: ZmlRight, locale: string): string {
  const lang = BCP47_TO_ZML[locale] ?? locale.split("-")[0] ?? "en";
  const names = right.display_name;
  const pick = names[lang];
  if (pick && pick !== names.en) return pick;
  if (lang === "he" && names.he && !isAsciiSlug(names.he)) return names.he;
  return names.en;
}

function isAsciiSlug(s: string): boolean {
  return /^[a-z0-9 _.-]+$/i.test(s) && /[a-z]/i.test(s);
}
