import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PriorityActions } from "@/components/PriorityActions";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "הכסף שלי — זכאי",
  description: "מפת חיובים ופעולות — בלי סיסמאות בנק.",
};

export default async function MoneyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {he ? "הכסף שלי" : "My money"}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight m-0">
        {he ? "איפה הכסף יורד — ומה עושים עכשיו" : "Where money goes — and what to do"}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mt-4 max-w-[560px]">
        {he
          ? "בלי סיסמה לבנק. צילום מסך או סריקה, ואז פעולה: ביטול מנוי, משא ומתן, החזר, זכויות."
          : "No bank password. Screenshot or scan, then act: cancel, negotiate, refund, rights."}
      </p>

      <div className="flex flex-wrap gap-3 mt-6">
        <Link href="/scan">
          <Button>{he ? "סרוק חיובים" : "Scan charges"}</Button>
        </Link>
        <Link href="/cancel">
          <Button variant="ghost">{he ? "בטל מנוי" : "Cancel a sub"}</Button>
        </Link>
        <Link href="/leaks">
          <Button variant="ghost">{he ? "מפת נזילות" : "Leaks map"}</Button>
        </Link>
        <Link href="/check">
          <Button variant="ghost">{he ? "בדיקת חשבון" : "Bill check"}</Button>
        </Link>
      </div>

      <h2 className="font-extrabold text-lg mt-12 mb-4">{he ? "הכי כדאי עכשיו" : "Best next moves"}</h2>
      <PriorityActions limit={6} />

      <p className="mt-10 text-[12px] text-ink-soft leading-relaxed">
        {he
          ? "הפוטנציאל הוא אומדן לסידור עדיפויות בלבד — לא הבטחה. עמלה רק על חיסכון מתועד."
          : "Potentials are for prioritization only — not a promise. Fee only on documented savings."}
      </p>
    </main>
  );
}
