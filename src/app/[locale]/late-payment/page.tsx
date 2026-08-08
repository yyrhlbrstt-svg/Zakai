import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LatePaymentClaim } from "@/components/LatePaymentClaim";
import { Link } from "@/i18n/routing";
import { alternateLanguages } from "@/lib/seo";
import { bcp47, type Locale } from "@/i18n/config";
import { heEn } from "@/lib/heEn";
import { smtpFullyConfigured } from "@/lib/deploy/smtpConfigured";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "latePayment" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/late-payment") },
  };
}

export default async function LatePaymentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("latePayment");

  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-4 max-w-[600px]">{t("subtitle")}</p>
      <p className="mb-6 text-[13.5px] text-ink-soft leading-relaxed border border-[rgba(63,203,155,0.28)] rounded-xl px-4 py-3 bg-[rgba(63,203,155,0.06)]">
        {he
          ? "דרישת תשלום → תיק → Mandate → שליחה → מעקב עד חיסכון מתועד."
          : "Payment demand → case → Mandate → send → track until documented recovery."}{" "}
        <Link href="/money" className="text-emerald font-extrabold no-underline hover:underline">
          {heEn(he, "לכסף שלי", "My money")}
        </Link>
      </p>
      <LatePaymentClaim bcp47={bcp47[locale as Locale]} mailLive={smtpFullyConfigured()} />
    </main>
  );
}
