import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { RefundChaseTool } from "@/components/RefundChaseTool";

export const metadata: Metadata = {
  title: "דרישת החזר כספי — זכאי",
  description: "החזר שלא הגיע מהחנות? מכתב דרישה מיידי להעתקה.",
};

export default async function RefundChasePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[640px] mx-auto px-5 pb-24 pt-4">
      <h1 className="font-display text-3xl my-3">{he ? "החזר שלא הגיע" : "Missing refund"}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6">
        {he
          ? "הזמנה בוטלה, מוצר חזר, הבטיחו החזר — והכסף לא בחשבון. כאן מכינים דרישה חדה בכתב."
          : "Order cancelled, item returned, refund promised — still nothing. Draft a firm written demand."}
      </p>
      <RefundChaseTool />
    </main>
  );
}
