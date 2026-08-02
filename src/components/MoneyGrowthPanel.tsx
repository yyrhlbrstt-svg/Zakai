import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { ShareResult } from "@/components/ShareResult";
import type { Locale } from "@/i18n/config";

/**
 * Zero-CAC growth on the Money hub: logged-in users share with referral code;
 * guests share the product entry without inventing savings amounts.
 */
export async function MoneyGrowthPanel({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "share" });
  const user = await getCurrentUser();
  if (!user) {
    return <ShareResult message={t("msgReferral")} path="/money" />;
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { referralCode: true },
  });

  return (
    <ShareResult
      message={t("msgReferral")}
      referralCode={row?.referralCode || undefined}
    />
  );
}
