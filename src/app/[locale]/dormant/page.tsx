import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DormantScreen } from "@/components/DormantScreen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dormant" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function DormantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dormant");

  return (
    <main className="max-w-[760px] mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mt-0 mb-2">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] mt-0 mb-7 leading-relaxed">{t("subtitle")}</p>
      <DormantScreen />
    </main>
  );
}
