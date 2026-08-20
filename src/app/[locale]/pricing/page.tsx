import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/user";
import { PlanCards } from "@/components/PlanCards";
import { MaxPlanRoi } from "@/components/MaxPlanRoi";
import { isPlanId, type PlanId } from "@/lib/plans";
import { bcp47, type Locale } from "@/i18n/config";
import { publicPageMetadata } from "@/lib/seo";
import { realPaymentsConfigured } from "@/lib/payments";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return publicPageMetadata(locale, {
    title: t("pricing.t"),
    description: t("pricing.d"),
    path: "/pricing",
  });
}

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
      <p className="text-ink-soft text-center text-body-lg mt-3 mb-10 max-w-[540px] mx-auto leading-relaxed">
        {t("subtitle")}
      </p>
      <PlanCards
        currentPlan={currentPlan}
        bcp47={bcp47[locale as Locale]}
        paymentsLive={realPaymentsConfigured()}
      />
      <MaxPlanRoi bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
