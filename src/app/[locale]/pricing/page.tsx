import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/user";
import { PlanCards } from "@/components/PlanCards";
import { isPlanId, type PlanId } from "@/lib/plans";
import { bcp47, type Locale } from "@/i18n/config";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  const t = await getTranslations("pricing");

  const currentPlan: PlanId | null = user && isPlanId(user.plan) ? user.plan : null;

  return (
    <main className="max-w-[980px] mx-auto px-5 pb-24 pt-4">
      <h1 className="font-display text-[clamp(30px,4.5vw,40px)] text-center mt-4">
        {t("title")}
      </h1>
      <p className="text-ink-soft text-center text-[15px] mt-3 mb-10 max-w-[540px] mx-auto leading-relaxed">
        {t("subtitle")}
      </p>
      <PlanCards currentPlan={currentPlan} bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
