import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ParkingAppeal } from "@/components/ParkingAppeal";

export const metadata: Metadata = {
  title: "ערעור על דוח חניה — זכאי",
  description:
    "קיבלת דוח חניה? הרבה דוחות נופלים על פגמים. זכאי מכין לך מכתב ערעור מוכן לשליחה. רץ בדפדפן, בלי מסמכים.",
};

export default async function ParkingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("parking");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <ParkingAppeal />
    </main>
  );
}
