import "server-only";
import { prisma } from "@/lib/prisma";
import { localeForCountry, localePath, parseLocaleParam } from "@/lib/localePath";

/**
 * Redirect after PSP return.
 * Paid → /money finish surface (share unlocks there).
 * Error → dashboard checkout retry.
 */
export async function dashboardFeeRedirectPath(
  feeParam: "paid" | "error",
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

  if (caseId) {
    return localePath(
      locale,
      `/dashboard?case=${encodeURIComponent(caseId)}&payFee=1&fee=error`,
    );
  }
  return localePath(locale, "/dashboard?fee=error");
}
