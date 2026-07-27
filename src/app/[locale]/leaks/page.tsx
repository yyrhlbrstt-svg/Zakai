import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "איפה הכסף בורח — זכאי",
  description: "מפת נזילות כסף: מנויים, ריבית, החזרים, חשבונות, זכויות.",
};

const LEAKS = [
  { href: "/money", he: "חיובים קבועים ששכחת", en: "Forgotten recurring charges", subHe: "צילום מסך מהבנק → זיהוי", subEn: "Bank screenshot → detect" },
  { href: "/cancel", he: "ביטול / הנחת מנוי", en: "Cancel or discount a sub", subHe: "מכתב מיידי לכל חברה", subEn: "Instant letter to any company" },
  { href: "/check", he: "סלולר / אינטרנט יקר", en: "Expensive mobile / internet", subHe: "משא ומתן מתועד", subEn: "Documented negotiation" },
  { href: "/credit-card", he: "ריבית כרטיס אשראי", en: "Card interest bleed", subHe: "כמה זה עולה כל חודש", subEn: "What it costs monthly" },
  { href: "/refund-chase", he: "החזר שלא הגיע", en: "Missing refund", subHe: "דרישה לחנות", subEn: "Demand to the store" },
  { href: "/electricity", he: "חשמל", en: "Electricity", subHe: "מעבר / בדיקת תעריף", subEn: "Switch / rate check" },
  { href: "/bank-fees", he: "עמלות בנק", en: "Bank fees", subHe: "מה ניתן לערער", subEn: "What to dispute" },
  { href: "/duplicate-insurance", he: "ביטוח כפול", en: "Duplicate insurance", subHe: "כיסוי מיותר", subEn: "Wasted cover" },
  { href: "/taxrefund", he: "החזר מס", en: "Tax refund", subHe: "עד 6 שנים אחורה", subEn: "Up to 6 years back" },
  { href: "/what-am-i-owed", he: "זכויות מהמדינה", en: "State entitlements", subHe: "מה מגיע לפי המצב שלך", subEn: "What fits your situation" },
  { href: "/flights", he: "פיצוי טיסה", en: "Flight compensation", subHe: "עיכוב / ביטול", subEn: "Delay / cancel" },
  { href: "/payslip", he: "תלוש שכר", en: "Payslip gaps", subHe: "מינימום, פנסיה, הבראה", subEn: "Wage, pension, convalescence" },
];

export default async function LeaksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[900px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {he ? "מפת נזילות" : "Money leaks map"}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,42px)] leading-tight m-0">
        {he ? "איפה הכסף בורח — ומה עושים" : "Where money leaks — and what to do"}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mt-4 max-w-[640px]">
        {he
          ? "לא מחכים לבנק ולא למוקד. כל כרטיס = בעיה שכיחה + כלי בזכאי שסוגר אותה."
          : "No waiting on a bank or a call center. Each card = a common leak + a Zakai tool."}
      </p>

      <div className="grid gap-4 mt-10 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {LEAKS.map((l) => (
          <Link key={l.href} href={l.href} className="no-underline text-ink">
            <SpotlightCard className="p-5 h-full hover:border-[rgba(63,203,155,0.45)] transition-colors">
              <div className="font-extrabold text-[15px]">{he ? l.he : l.en}</div>
              <div className="text-ink-soft text-[12.5px] mt-1.5">{he ? l.subHe : l.subEn}</div>
            </SpotlightCard>
          </Link>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link href="/money">
          <Button>{he ? "התחל מהכסף שלי" : "Start with My money"}</Button>
        </Link>
      </div>
    </main>
  );
}
