import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { StatementScan } from "@/components/StatementScan";
import { planConfig } from "@/lib/plans";
import { aiAvailable } from "@/lib/ai";
import { bcp47, type Locale } from "@/i18n/config";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  const t = await getTranslations("scan");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[560px]">
        {t("subtitle")}
      </p>
      <StatementScan
        fullScan={planConfig(user!.plan).fullScan}
        bcp47={bcp47[locale as Locale]}
        screenshotEnabled={aiAvailable()}
      />
    </main>
  );
}
