import "server-only";
import { prisma } from "@/lib/prisma";
import { localeForCountry, localePath, parseLocaleParam } from "@/lib/localePath";

/** Redirect target after PSP return — locale from payer's account when fee id known. */
export async function dashboardFeeRedirectPath(
  feeParam: "paid" | "error",
  feeId?: string | null,
  localeHint?: string | null,
): Promise<string> {
  let locale = parseLocaleParam(localeHint);
  if (feeId) {
    const fee = await prisma.fee.findUnique({
      where: { id: feeId },
      select: { case: { select: { user: { select: { country: true } } } } },
    });
    if (fee?.case?.user) {
      locale = localeForCountry(fee.case.user.country);
    }
  }
  return localePath(locale, `/dashboard?fee=${feeParam}`);
}
