import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PensionFeesCalculator } from "@/components/PensionFeesCalculator";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pensionFees" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function PensionFeesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pensionFees");

  return (
    <main className="max-w-[820px] mx-auto px-5 pb-24 pt-3">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[620px]">{t("subtitle")}</p>
      <PensionFeesCalculator />
    </main>
  );
}
