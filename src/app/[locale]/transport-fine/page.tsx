import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { TransportFineAppeal } from "@/components/TransportFineAppeal";
import { Link } from "@/i18n/routing";
import { alternateLanguages } from "@/lib/seo";
import { getVerticalOutcomeStat } from "@/lib/strategy/insights";
import { bcp47, type Locale } from "@/i18n/config";
import { heEn } from "@/lib/heEn";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transportFine" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/transport-fine") },
  };
}

export default async function TransportFinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("transportFine");
  const stat = await getVerticalOutcomeStat("transport_fine", "transport_operator");
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-4 max-w-[600px]">{t("subtitle")}</p>
      <p className="mb-6 text-[13.5px] text-ink-soft leading-relaxed border border-[rgba(63,203,155,0.28)] rounded-xl px-4 py-3 bg-[rgba(63,203,155,0.06)]">
        {he
          ? "ערעור → תיק → Mandate → שליחה → מעקב עד חיסכון מתועד. אותו מסלול כמו בכסף שלי."
          : "Appeal → case → Mandate → send → track until documented saving. Same loop as My money."}{" "}
        <Link href="/money" className="text-emerald font-extrabold no-underline hover:underline">
          {heEn(he, "לכסף שלי", "My money")}
        </Link>
      </p>
      <TransportFineAppeal stat={stat} bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
