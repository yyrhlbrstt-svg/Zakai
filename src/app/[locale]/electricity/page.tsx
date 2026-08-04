import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ElectricityCalculator } from "@/components/ElectricityCalculator";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Link } from "@/i18n/routing";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";
import { heEn } from "@/lib/heEn";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "electricity" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/electricity") },
  };
}

/** Public page — comparison is value anyone can get; acting comes later. */
export default async function ElectricityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("electricity");

  const he = locale === "he" || locale === "ar";

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("subtitle")}>
      <p className="mb-5 text-[13.5px] text-ink-soft leading-relaxed border border-[rgba(63,203,155,0.28)] rounded-xl px-4 py-3 bg-[rgba(63,203,155,0.06)]">
        {he
          ? "השוואה חופשית כאן — ואז תיק עם Mandate: אישור → שליחה → מעקב → חיסכון מתועד. אותו מסלול כמו בכסף שלי."
          : "Compare freely here — then open a Mandate case: approve → send → track → documented saving. Same loop as My money."}{" "}
        <Link href="/money" className="text-emerald font-extrabold no-underline hover:underline">
          {heEn(he, "לכסף שלי", "My money")}
        </Link>
      </p>
      <ElectricityCalculator bcp47={bcp47[locale as Locale]} />
    </VerticalPageShell>
  );
}
