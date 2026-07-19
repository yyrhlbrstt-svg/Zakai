import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { TransportFineAppeal } from "@/components/TransportFineAppeal";

export const metadata: Metadata = {
  title: "ערעור על דו\"ח בתחבורה ציבורית — זכאי",
  description:
    "קיבלת קנס ממפקח באוטובוס או ברכבת? הרבה דוחות ניתנים לביטול. זכאי מכין לך מכתב ערעור מוכן לשליחה. רץ בדפדפן.",
};

export default async function TransportFinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("transportFine");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <TransportFineAppeal />
    </main>
  );
}
