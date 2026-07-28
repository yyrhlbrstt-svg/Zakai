import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { CancelTool } from "@/components/CancelTool";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "ביטול מנוי / הנחה עם הסוכן — זכאי",
  description:
    "הסוכן של זכאי מבטל מנוי, מבקש הנחה או מקפיא — שולח עם Mandate, עוקב ומתעד חיסכון. בלי מוקד, בלי להשאיר טלפון.",
};

export default async function CancelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[640px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-4">
        {he ? "סוכן · Mandate · בלי מוקד" : "Agent · Mandate · no callback"}
      </div>
      <h1 className="font-display text-3xl my-3">
        {he ? "בטל · הקפא · הורד מחיר — הסוכן עושה" : "Cancel · pause · lower price — agent does it"}
      </h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-5 max-w-[560px]">
        {he
          ? "נטפליקס, ספוטיפיי, חדר כושר, ענן, מגזינים, אפליקציות — הסוכן מכין, שולח עם Mandate, עוקב ומתעד חיסכון. בלי להמתין לאף אחד, בלי מוקד."
          : "Netflix, gym, cloud, apps — the agent drafts, sends with Mandate, follows up and records the saving. No waiting on anyone."}
      </p>

      <div className="flex flex-wrap gap-2.5 mb-6">
        <Link href="/money">
          <Button variant="ghost" className="!text-[13px] !py-2">
            {he ? "קודם סרוק חיובים" : "Scan charges first"}
          </Button>
        </Link>
        <Link href="/what-am-i-owed">
          <Button variant="ghost" className="!text-[13px] !py-2">
            {he ? "מה מגיע לי?" : "What am I owed?"}
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="text-ink-soft text-[14px]">{he ? "טוען…" : "Loading…"}</div>}>
        <CancelTool />
      </Suspense>

      <div className="mt-8 rounded-2xl border border-[rgba(63,203,155,0.25)] bg-[rgba(63,203,155,0.06)] px-4 py-4 text-center">
        <p className="text-[13.5px] text-ink-soft m-0 leading-relaxed">
          {he
            ? "הסוכן שולח, עוקב, ומתעד. עמלה רק על חיסכון מתועד. בלי להשאיר טלפון."
            : "Agent sends, follows up, and records. Fee only on documented savings. No phone left behind."}
        </p>
        <Link href="/money" className="inline-block mt-3 text-emerald font-extrabold text-[14px] no-underline">
          {he ? "הכסף שלי →" : "My money →"}
        </Link>
      </div>
    </main>
  );
}
