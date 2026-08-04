import type { Locale } from "@/i18n/config";
import { absoluteLocaleUrl, localeForCountry, localePath } from "@/lib/localePath";

/**
 * Finish-surface deep link for a case fee.
 * `payFee=1` only when Mandate is ACTIVE — otherwise land on reissue (#91/#94).
 */
export function feePayDashboardPath(
  locale: Locale,
  caseId: string,
  mandateActive = true,
): string {
  const q = new URLSearchParams({ case: caseId });
  if (mandateActive) q.set("payFee", "1");
  return localePath(locale, `/money?${q.toString()}`);
}

export function feePayAbsoluteUrl(
  baseUrl: string,
  country: string | null | undefined,
  caseId: string,
  mandateActive = true,
): string {
  const locale = localeForCountry(country);
  const q = new URLSearchParams({ case: caseId });
  if (mandateActive) q.set("payFee", "1");
  return absoluteLocaleUrl(baseUrl, locale, `/money?${q.toString()}`);
}
