import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { RightsChecker } from "@/components/RightsChecker";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trainDelay" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/train-delay") },
  };
}

export default async function TrainDelayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("trainDelay");

  return (
    <VerticalPageShell
      kicker={t("kicker")}
      title={t("title")}
      sub={t("sub")}
      cite={t("cite")}
      footer={
        <div className="mt-8 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5 text-center">
          <p className="text-[14px] font-bold m-0">{t("euTitle")}</p>
          <p className="text-ink-soft text-[13px] mt-2 mb-4">{t("euSub")}</p>
          <Link href="/flights">
            <Button>{t("euCta")}</Button>
          </Link>
        </div>
      }
    >
      <RightsChecker bcp47={bcp47[locale as Locale]} defaultCountry="IL" />
    </VerticalPageShell>
  );
}
