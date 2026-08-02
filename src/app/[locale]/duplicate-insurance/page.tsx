import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LeadCta } from "@/components/LeadCta";
import { Reveal } from "@/components/Reveal";
import { InsuranceChecker } from "@/components/InsuranceChecker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "insurance" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function DuplicateInsurancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("insurance");

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")}>
      <Reveal delay={80}>
        <div className="mt-2">
          <InsuranceChecker />
        </div>
      </Reveal>
      <LeadCta vertical="duplicate-insurance" />

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </VerticalPageShell>
  );
}
