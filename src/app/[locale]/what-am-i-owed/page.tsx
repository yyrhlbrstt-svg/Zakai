import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PotentialTotal } from "@/components/PotentialTotal";

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

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-5">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {t("kicker")}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,44px)] leading-[1.12] m-0 text-balance">
        {t("title")}
      </h1>
      <p className="text-ink-soft text-[16px] leading-relaxed mt-3 mb-8 max-w-[600px]">{t("sub")}</p>
      <PotentialTotal />
    </main>
  );
}
