import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { VerticalPageShell } from "@/components/VerticalPageShell";

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
    <VerticalPageShell
      heroGlow
      width="narrow"
      className="max-w-[620px] mx-auto px-5 pb-24 pt-8 relative"
      kicker={`🙏 ${t("navCta")}`}
      title={t("pageTitle")}
      sub={t("pageSub")}
    >
      <FeedbackWidget compact />
    </VerticalPageShell>
  );
}
