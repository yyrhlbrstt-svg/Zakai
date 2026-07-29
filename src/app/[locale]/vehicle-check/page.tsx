import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VehicleCheckScreen } from "@/components/VehicleCheckScreen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "vehicleCheck" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function VehicleCheckPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("vehicleCheck");

  return (
    <main className="max-w-[760px] mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mt-0 mb-2">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] mt-0 mb-7 leading-relaxed">{t("subtitle")}</p>
      <VehicleCheckScreen />
    </main>
  );
}
