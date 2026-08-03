import "server-only";
import { prisma } from "@/lib/prisma";
import { localeForCountry, localePath, parseLocaleParam } from "@/lib/localePath";

/**
 * Redirect after PSP return.
 * Paid → /money finish surface (share unlocks there).
 * Confirming → /money while webhook may still be in flight (never claim paid from GET).
 * Error → /money checkout retry (same surface).
 */
export async function dashboardFeeRedirectPath(
  feeParam: "paid" | "error" | "confirming",
  feeId?: string | null,
  localeHint?: string | null,
): Promise<string> {
  let locale = parseLocaleParam(localeHint);
  let caseId: string | undefined;
  if (feeId) {
    const fee = await prisma.fee.findUnique({
      where: { id: feeId },
      select: { case: { select: { id: true, user: { select: { country: true } } } } },
    });
    if (fee?.case?.user) {
      locale = localeForCountry(fee.case.user.country);
    }
    caseId = fee?.case?.id;
  }

  if (feeParam === "paid") {
    if (caseId) {
      return localePath(
        locale,
        `/money?case=${encodeURIComponent(caseId)}&fee=paid`,
      );
    }
    return localePath(locale, "/money?fee=paid");
  }

  if (feeParam === "confirming") {
    if (caseId) {
      return localePath(
        locale,
        `/money?case=${encodeURIComponent(caseId)}&fee=confirming`,
      );
    }
    return localePath(locale, "/money?fee=confirming");
  }

  if (caseId) {
    return localePath(
      locale,
      `/money?case=${encodeURIComponent(caseId)}&payFee=1&fee=error`,
    );
  }
  return localePath(locale, "/money?fee=error");
}
