import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "איפה הכסף בורח — זכאי Money OS",
  description:
    "מפת נזילות כסף גלובלית: מנויים, סלולר, עמלות, ביטוח, זכויות — הסוכן של זכאי סוגר בלי מוקד.",
};

/** Every leak points at an agent path — not a passive calculator. */
const LEAKS = [
  {
    href: "/money",
    he: "חיובים קבועים ששכחת",
    en: "Forgotten recurring charges",
    subHe: "צילום מסך → הסוכן פותח תיק",
    subEn: "Screenshot → agent opens a case",
    rank: 1,
  },
  {
    href: "/cancel",
    he: "מנוי שאפשר לבטל / להוריד",
    en: "Sub to cancel or discount",
    subHe: "הסוכן שולח עם Mandate",
    subEn: "Agent sends with Mandate",
    rank: 1,
  },
  {
    href: "/check",
    he: "סלולר / אינטרנט מופקע",
    en: "Overpriced mobile / internet",
    subHe: "משא ומתן מתועד + מעקב",
    subEn: "Documented negotiation + follow-up",
    rank: 1,
  },
  {
    href: "/credit-card",
    he: "ריבית כרטיס אשראי",
    en: "Card interest bleed",
    subHe: "כמה זה עולה — ואז פעולה",
    subEn: "See the cost — then act",
    rank: 2,
  },
  {
    href: "/refund-chase",
    he: "החזר שלא הגיע",
    en: "Missing refund",
    subHe: "דרישה בכתב דרך הסוכן",
    subEn: "Written demand via agent",
    rank: 2,
  },
  {
    href: "/electricity",
    he: "חשמל יקר",
    en: "Expensive electricity",
    subHe: "השוואה → מעבר / פנייה",
    subEn: "Compare → switch / claim",
    rank: 2,
  },
  {
    href: "/bank-fees",
    he: "עמלות בנק",
    en: "Bank fees",
    subHe: "מכתב ערעור מוכן",
    subEn: "Ready dispute letter",
    rank: 2,
  },
  {
    href: "/duplicate-insurance",
    he: "ביטוח כפול",
    en: "Duplicate insurance",
    subHe: "כיסוי מיותר → ביטול",
    subEn: "Wasted cover → cancel",
    rank: 2,
  },
  {
    href: "/taxrefund",
    he: "החזר מס",
    en: "Tax refund",
    subHe: "עד 6 שנים אחורה",
    subEn: "Up to 6 years back",
    rank: 3,
  },
  {
    href: "/what-am-i-owed",
    he: "זכויות מהמדינה",
    en: "State entitlements",
    subHe: "מה מגיע לפי המצב שלך",
    subEn: "What fits your situation",
    rank: 3,
  },
  {
    href: "/flights",
    he: "פיצוי טיסה",
    en: "Flight compensation",
    subHe: "עיכוב / ביטול → דרישה",
    subEn: "Delay / cancel → claim",
    rank: 3,
  },
  {
    href: "/payslip",
    he: "פערים בתלוש",
    en: "Payslip gaps",
    subHe: "מינימום, פנסיה, הבראה",
    subEn: "Wage, pension, convalescence",
    rank: 3,
  },
] as const;

export default async function LeaksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[900px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {he ? "מפת נזילות · Money OS" : "Money leaks map · Money OS"}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,42px)] leading-tight m-0">
        {he ? "איפה הכסף בורח — הסוכן סוגר" : "Where money leaks — the agent closes it"}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mt-4 max-w-[640px]">
        {he
          ? "זכאי הוא הסטנדרט לסוכן כסף צרכני: בלי מוקד, בלי להשאיר טלפון, עמלה רק על חיסכון מתועד. כל כרטיס מוביל לפעולה עם Mandate."
          : "Zakai is the standard consumer money agent: no call center, no phone left behind, fee only on documented savings. Every card leads to Mandate action."}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/money">
          <Button className="!text-[15px] !px-5 !py-3">
            {he ? "הכסף שלי — סרוק עכשיו" : "My money — scan now"}
          </Button>
        </Link>
        <Link href="/cancel">
          <Button variant="ghost">{he ? "ביטול מנוי עם סוכן" : "Cancel with agent"}</Button>
        </Link>
      </div>

      <div className="grid gap-4 mt-10 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {LEAKS.map((l) => (
          <Link key={l.href + l.he} href={l.href} className="no-underline text-ink">
            <SpotlightCard
              className={`p-5 h-full hover:border-[rgba(63,203,155,0.45)] transition-colors ${
                l.rank === 1 ? "border-[rgba(63,203,155,0.28)]" : ""
              }`}
            >
              {l.rank === 1 && (
                <div className="text-[11px] font-extrabold text-emerald uppercase tracking-wide mb-1.5">
                  {he ? "עדיפות גבוהה" : "High ROI"}
                </div>
              )}
              <div className="font-extrabold text-[15px]">{he ? l.he : l.en}</div>
              <div className="text-ink-soft text-[12.5px] mt-1.5">{he ? l.subHe : l.subEn}</div>
            </SpotlightCard>
          </Link>
        ))}
      </div>

      <div className="mt-14 rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] px-6 py-8 text-center">
        <div className="font-display text-[clamp(20px,3.5vw,28px)]">
          {he ? "מוביל הקטגוריה לא ממתין לטלפון" : "Category leaders don’t wait on a phone call"}
        </div>
        <p className="text-ink-soft text-[14px] mt-3 max-w-[480px] mx-auto leading-relaxed">
          {he
            ? "סריקה → תיק → Mandate → שליחה → מעקב → חיסכון מתועד → שיתוף. זה הלולאה."
            : "Scan → case → Mandate → send → follow-up → documented saving → share. That’s the loop."}
        </p>
        <Link href="/money" className="inline-block mt-5">
          <Button>{he ? "התחל מהכסף שלי" : "Start with My money"}</Button>
        </Link>
      </div>
    </main>
  );
}
