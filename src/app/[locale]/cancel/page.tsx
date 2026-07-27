import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CancelTool } from "@/components/CancelTool";
import { Link } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "ביטול מנוי / הנחה עם הסוכן — זכאי",
  description: "הסוכן של זכאי מבטל מנוי, מבקש הנחה או מקפיא — שולח עם Mandate, עוקב ומתעד חיסכון. בלי מוקד, בלי להשאיר טלפון.",
};

export default async function CancelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[640px] mx-auto px-5 pb-24 pt-4">
      <h1 className="font-display text-3xl my-3">{he ? "בטל · הקפא · הורד מחיר — הסוכן עושה" : "Cancel · pause · lower price — agent does it"}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[560px]">
        {he
          ? "נטפליקס, ספוטיפיי, חדר כושר, ענן, מגזינים, אפליקציות — הסוכן מכין, שולח עם Mandate, עוקב ומתעד חיסכון. בלי להמתין לאף אחד, בלי מוקד."
          : "Netflix, gym, cloud, apps — the agent drafts, sends with Mandate, follows up and records the saving. No waiting on anyone."}
      </p>
      <CancelTool />
      <p className="mt-6 text-[13px] text-ink-soft">
        {he ? "קודם רוצים לראות מה יורד?" : "Want to see charges first?"}{" "}
        <Link href="/money" className="text-emerald font-bold no-underline">
          {he ? "הכסף שלי" : "My money"}
        </Link>
      </p>
    </main>
  );
}
