import "server-only";

import { withFooter, type FooterLocale } from "@/lib/letterFooter";
import { localeForCountry } from "@/lib/localePath";

export function footerLocaleForCountry(country: string | null | undefined): FooterLocale {
  const loc = localeForCountry(country || "IL");
  return loc === "he" || loc === "ar" ? "he" : "en";
}

export function formatCaseDraft(
  subject: string,
  body: string,
  country: string | null | undefined,
): string {
  const locale = footerLocaleForCountry(country);
  return `${subject}\n\n${withFooter(body, locale)}`;
}
