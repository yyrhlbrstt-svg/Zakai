import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { FeedbackWidget } from "@/components/FeedbackWidget";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "feedback" });
  return { title: t("pageTitle") };
}

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("feedback");

  return (
    <main className="max-w-[620px] mx-auto px-5 pb-24 pt-8">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        🙏 {t("navCta")}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-[1.14] m-0 text-balance">
        {t("pageTitle")}
      </h1>
      <p className="text-ink-soft text-[16px] leading-relaxed mt-3 mb-8">{t("pageSub")}</p>
      <FeedbackWidget compact />
    </main>
  );
}
