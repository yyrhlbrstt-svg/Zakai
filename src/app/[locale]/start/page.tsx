import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LeadForm } from "@/components/LeadForm";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "התחל עכשיו — זכאי",
  description: "פעולה מיידית בתוך זכאי. בלי להמתין לשיחה חזרה.",
};

export default async function StartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { locale } = await params;
  const { v } = await searchParams;
  setRequestLocale(locale);

  const vertical = (v || "general").replace(/[^a-z-]/g, "").slice(0, 60) || "general";
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[560px] mx-auto px-5 pb-24 pt-8">
      <div className="flex items-center gap-3 mb-5">
        <LogoMark size={44} />
        <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5">
          {he ? "פעולה מיידית · בלי המתנה · בלי שיחה חזרה" : "Act now · no callback"}
        </div>
      </div>
      <h1 className="font-display text-[clamp(26px,5vw,38px)] leading-[1.14] m-0 text-balance mb-3">
        {he ? "מה אפשר לעשות עכשיו" : "What you can do now"}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-7">
        {he
          ? "אין צוות שמתקשר חזרה. כאן מקבלים כלים ותשובות בתוך זכאי — בדיקה, ניסוח פנייה, והורדת מחיר."
          : "No call-back team. Tools and answers inside Zakai."}
      </p>
      <LeadForm vertical={vertical} />
    </main>
  );
}
