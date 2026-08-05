import type { Locale } from "@/i18n/config";
import { absoluteLocaleUrl, localeForCountry, localePath } from "@/lib/localePath";
import { feeConfirmAutoCheckout } from "@/lib/feeConfirmNotify";

/**
 * Finish-surface deep link for a case fee.
 * `payFee=1` only when Mandate is ACTIVE **and** a real PSP is configured —
 * never invent auto-checkout under mock (same bar as settle email #99).
 */
export function feePayDashboardPath(
  locale: Locale,
  caseId: string,
  opts: { mandateActive: boolean; paymentsLive: boolean },
): string {
  const q = new URLSearchParams({ case: caseId });
  if (feeConfirmAutoCheckout(opts)) q.set("payFee", "1");
  return localePath(locale, `/money?${q.toString()}`);
}

export function feePayAbsoluteUrl(
  baseUrl: string,
  country: string | null | undefined,
  caseId: string,
  opts: { mandateActive: boolean; paymentsLive: boolean },
): string {
  const locale = localeForCountry(country);
  const q = new URLSearchParams({ case: caseId });
  if (feeConfirmAutoCheckout(opts)) q.set("payFee", "1");
  return absoluteLocaleUrl(baseUrl, locale, `/money?${q.toString()}`);
}
