import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { DeadlineTracker } from "@/components/DeadlineTracker";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "deadlines" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/deadlines") },
  };
}

export default async function DeadlinesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("deadlines");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <DeadlineTracker />

      {/* A deadline here is a label and a date somebody typed. A commitment
          carries the contract behind it — the renewal date and the notice
          period — so the act-by date stays right if either is corrected, and
          the weekly watch can chase it without anyone opening the app. This
          page had no way onward at all; that record is the honest one. */}
      <p className="text-ink-soft text-body mt-8 mb-0 leading-relaxed">
        {t("commitmentsHint")}{" "}
        <Link href="/commitments" className="text-emerald font-bold no-underline">
          {t("commitmentsLink")}
        </Link>
      </p>
    </main>
  );
}
