import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ContractRedFlagChecker } from "@/components/ContractRedFlagChecker";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contractCheck" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/contract-check") },
  };
}

export default async function ContractCheckPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contractCheck");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <ContractRedFlagChecker />
      <p className="mt-6 text-[11.5px] text-[rgba(147,166,165,0.7)] leading-relaxed max-w-[600px]">
        {t("disclaimer")}
      </p>
    </main>
  );
}
