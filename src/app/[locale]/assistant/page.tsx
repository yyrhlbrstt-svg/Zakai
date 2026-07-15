import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { buildInsights } from "@/lib/services/insights";
import { aiAvailable } from "@/lib/ai";
import { planConfig } from "@/lib/plans";
import { AssistantScreen } from "@/components/AssistantScreen";
import { bcp47, type Locale } from "@/i18n/config";

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  const t = await getTranslations("assistant");
  const insights = await buildInsights(user!.id);

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[540px]">
        {t("subtitle")}
      </p>
      <AssistantScreen
        insights={insights}
        chatEnabled={aiAvailable()}
        plan={planConfig(user!.plan).id}
        bcp47={bcp47[locale as Locale]}
      />
    </main>
  );
}
