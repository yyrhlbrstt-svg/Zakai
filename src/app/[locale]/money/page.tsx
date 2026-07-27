import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { MoneyHub } from "@/components/MoneyHub";
import { Button } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "הכסף שלי — זכאי",
  description: "מפת חיובים ופעולות עם סוכן — בלי סיסמאות בנק. בלי מוקד.",
};

export default async function MoneyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";
  const loc = bcp47[locale as Locale];

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {he ? "Money OS · הכסף שלי" : "Money OS · My money"}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight m-0">
        {he ? "איפה הכסף יורד — והסוכן פועל" : "Where money goes — and the agent acts"}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mt-4 max-w-[560px]">
        {he
          ? "בלי סיסמה לבנק. צילום מסך או סריקה → זכאי מזהה חיובים קבועים → פותח תיק עם Mandate → שולח ומעקוב. עמלה רק על חיסכון מתועד."
          : "No bank password. Screenshot or scan → Zakai finds recurring charges → opens a Mandate case → sends and follows up. Fee only on documented savings."}
      </p>

      <div className="mt-8">
        <MoneyHub bcp47={loc} screenshotEnabled={aiAvailable()} />
      </div>

      <div className="mt-10 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-5">
        <div className="font-extrabold text-[14px]">{he ? "או פעולה ישירה" : "Or act directly"}</div>
        <div className="flex flex-wrap gap-3 mt-3">
          <Link href="/cancel">
            <Button variant="ghost" className="!text-[13px]">
              {he ? "ביטול מנוי עם סוכן" : "Cancel sub with agent"}
            </Button>
          </Link>
          <Link href="/check">
            <Button variant="ghost" className="!text-[13px]">
              {he ? "בדיקת חשבון סלולר" : "Cellular bill check"}
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" className="!text-[13px]">
              {he ? "הדשבורד שלי" : "My dashboard"}
            </Button>
          </Link>
        </div>
      </div>

      <p className="mt-10 text-[12px] text-ink-soft leading-relaxed">
        {he
          ? "הפוטנציאל הוא אומדן לסידור עדיפויות בלבד — לא הבטחה. עמלה רק על חיסכון מתועד. בלי מוקד, בלי להשאיר טלפון."
          : "Potentials are for prioritization only — not a promise. Fee only on documented savings. No call center, no phone left behind."}
      </p>
    </main>
  );
}
