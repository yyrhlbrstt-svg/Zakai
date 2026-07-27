import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LeadForm } from "@/components/LeadForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lead" });
  return { title: t("pageTitle") };
}

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
  const t = await getTranslations("lead");

  const vertical = (v || "general").replace(/[^a-z-]/g, "").slice(0, 60) || "general";

  let title = t("title");
  try {
    const key = `verticalTitles.${vertical}`;
    const candidate = t(key);
    if (candidate && candidate !== key) title = candidate;
  } catch {
    /* keep */
  }

  return (
    <main className="max-w-[560px] mx-auto px-5 pb-24 pt-8">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        פעולה מיידית · בלי המתנה
      </div>
      <h1 className="font-display text-[clamp(26px,5vw,38px)] leading-[1.14] m-0 text-balance mb-3">
        {title}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-7">
        אין צוות שמתקשר חזרה. כאן מקבלים כלים ותשובות בתוך זכאי — כולל ניסוח פנייה ומסלול להורדת מחיר.
      </p>
      <LeadForm vertical={vertical} title={title} />
    </main>
  );
}
