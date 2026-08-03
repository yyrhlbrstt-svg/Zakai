import type { Locale } from "@/i18n/config";
import { absoluteLocaleUrl, localeForCountry, localePath } from "@/lib/localePath";

/**
 * Finish-surface deep link that opens hosted checkout for a case fee.
 * Kept name for call-site stability; path is /money (not /dashboard).
 */
export function feePayDashboardPath(locale: Locale, caseId: string): string {
  const q = new URLSearchParams({ case: caseId, payFee: "1" });
  return localePath(locale, `/money?${q.toString()}`);
}

export function feePayAbsoluteUrl(
  baseUrl: string,
  country: string | null | undefined,
  caseId: string,
): string {
  const locale = localeForCountry(country);
  const q = new URLSearchParams({ case: caseId, payFee: "1" });
  return absoluteLocaleUrl(baseUrl, locale, `/money?${q.toString()}`);
}
