import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PotentialTotal } from "@/components/PotentialTotal";
import { Button } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "potential" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function WhatAmIOwedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("potential");
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-5">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {t("kicker")}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,44px)] leading-[1.12] m-0 text-balance">
        {t("title")}
      </h1>
      <p className="text-ink-soft text-[16px] leading-relaxed mt-3 mb-6 max-w-[600px]">{t("sub")}</p>

      {/* Problem-first secondary doors — drive action even before calc */}
      <div className="flex flex-wrap gap-2.5 mb-8">
        <Link href="/money">
          <Button className="!text-[13.5px] !px-4 !py-2.5">
            {he ? "סרוק חיובים עכשיו" : "Scan charges now"}
          </Button>
        </Link>
        <Link href="/cancel">
          <Button variant="ghost" className="!text-[13.5px]">
            {he ? "בטל מנוי עם סוכן" : "Cancel sub with agent"}
          </Button>
        </Link>
        <Link href="/leaks">
          <Button variant="ghost" className="!text-[13.5px]">
            {he ? "מפת נזילות" : "Leaks map"}
          </Button>
        </Link>
      </div>

      <PotentialTotal />

      <div className="mt-10 rounded-2xl border border-[rgba(63,203,155,0.28)] bg-[rgba(63,203,155,0.06)] px-5 py-5 text-center">
        <div className="font-extrabold text-[15px]">
          {he ? "מצאת פוטנציאל? תן לסוכן לפעול" : "Found potential? Let the agent act"}
        </div>
        <p className="text-ink-soft text-[13.5px] mt-2 max-w-[480px] mx-auto leading-relaxed">
          {he
            ? "סריקה → תיק עם Mandate → שליחה ומעקב. עמלה רק על חיסכון מתועד. בלי מוקד. בלי להשאיר טלפון."
            : "Scan → Mandate case → send and follow up. Fee only on documented savings. No call center. No phone left behind."}
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-4">
          <Link href="/money">
            <Button>{he ? "הכסף שלי →" : "My money →"}</Button>
          </Link>
          <Link href="/start">
            <Button variant="ghost">{he ? "התחל עכשיו" : "Start now"}</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
