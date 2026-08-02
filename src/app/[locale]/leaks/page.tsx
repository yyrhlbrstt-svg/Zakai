import type { Metadata } from "next";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Button } from "@/components/ui";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { alternateLanguages } from "@/lib/seo";
import { rankLeakEntries, topLeakHrefs } from "@/lib/leaksRank";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inline_app_locale_leaks_page" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/leaks") },
  };
}

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
    href: "/bank-loan-fee",
    he: "עמלת פתיחת הלוואה",
    en: "Loan opening / handling fee",
    subHe: "מכתב לבנק + אפשרות לסוכן ב-/bank-fees",
    subEn: "Bank letter + optional /bank-fees agent",
    rank: 2,
  },
  {
    href: "/collection-complaint",
    he: "גובה חוב מטריד",
    en: "Debt collector harassment",
    subHe: "מכתב תלונה + אימות חוב",
    subEn: "Complaint + verify debt letter",
    rank: 2,
  },
  {
    href: "/consumer-cancel",
    he: "מכון כושר / קורס — 14 יום",
    en: "Gym / course — 14-day cancel",
    subHe: "ביטול מרחוק לפי חוק",
    subEn: "Remote sale cancellation",
    rank: 2,
  },
  {
    href: "/water-bill",
    he: "חשבון מים אחרי נזילה",
    en: "Water bill after hidden leak",
    subHe: "מכתב להנחה לפי כללי תאגיד המים",
    subEn: "Leak-credit letter to water corp",
    rank: 2,
  },
  {
    href: "/vaad-bait",
    he: "ועד בית — חיובים לא מפורטים",
    en: "HOA charges without breakdown",
    subHe: "מכתב לפירוט ועדכון חיוב",
    subEn: "Transparency demand letter",
    rank: 2,
  },
  {
    href: "/landlord-repairs",
    he: "ליקוי בדירה שכורה",
    en: "Rental essential repairs",
    subHe: "מכתב דרישה לתיקון לפי חוק השכירות",
    subEn: "Statutory repair demand letter",
    rank: 2,
  },
  {
    href: "/duplicate-charge",
    he: "חיוב כפול / שגוי",
    en: "Duplicate or wrong charge",
    subHe: "מכתב ערעור + מסלול סוכן",
    subEn: "Dispute letter + agent path",
    rank: 2,
  },
  {
    href: "/telecom-exit",
    he: "ניתוק תקשורת והחזרים",
    en: "Telecom disconnect + refunds",
    subHe: "מכתב לפי חוק התקשורת",
    subEn: "Communications Act letter",
    rank: 2,
  },
  {
    href: "/car-insurance-refund",
    he: "החזר ביטוח רכב",
    en: "Car insurance refund",
    subHe: "ביטול פוליסה — פרמיה יחסית",
    subEn: "Pro-rata premium back",
    rank: 3,
  },
  {
    href: "/toll-dispute",
    he: "חיוב כביש 6",
    en: "Highway 6 charge",
    subHe: "ערעור לוועדה",
    subEn: "Statutory appeal",
    rank: 3,
  },
  {
    href: "/deposit",
    he: "פיקדון שכירות",
    en: "Rental deposit",
    subHe: "הסוכן דורש בכתב",
    subEn: "Agent written demand",
    rank: 2,
  },
  {
    href: "/duplicate-insurance",
    he: "ביטוח כפול",
    en: "Duplicate insurance",
    subHe: "הסוכן שולח ביטול בכתב + Mandate",
    subEn: "Agent cancellation + Mandate",
    rank: 2,
  },
  {
    href: "/arnona",
    he: "ארנונה ביתר / הנחה שלא הופעלה",
    en: "Arnona overcharge / missed discount",
    subHe: "הסוכן שולח השגה בכתב + Mandate",
    subEn: "Agent objection + Mandate",
    rank: 2,
  },
  {
    href: "/parking",
    he: "דוח חניה שאפשר לערער עליו",
    en: "Parking ticket you can appeal",
    subHe: "ערעור בכתב + Mandate דרך הסוכן",
    subEn: "Written appeal + Mandate via agent",
    rank: 2,
  },
  {
    href: "/transport-fine",
    he: "קנס תחבורה ציבורית",
    en: "Public-transport fine",
    subHe: "ערעור בכתב + Mandate דרך הסוכן",
    subEn: "Written appeal + Mandate via agent",
    rank: 2,
  },
  {
    href: "/late-payment",
    he: "לקוח שלא משלם בזמן",
    en: "Client not paying on time",
    subHe: "דרישה בכתב + Mandate דרך הסוכן",
    subEn: "Written demand + Mandate via agent",
    rank: 2,
  },
  {
    href: "/deposit",
    he: "פיקדון שכירות שהמשכיר לא מחזיר",
    en: "Rental deposit landlord won't return",
    subHe: "דרישה בכתב + Mandate דרך הסוכן",
    subEn: "Written demand + Mandate via agent",
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
  const tIapp_locale_leaks_page = await getTranslations({ locale, namespace: "inline_app_locale_leaks_page" });
  const ranked = await rankLeakEntries(LEAKS);
  const spotlight = topLeakHrefs(ranked, 4);

  return (
    <VerticalPageShell
      heroGlow
      className="max-w-[900px] mx-auto px-5 pb-24 pt-4"
      kicker={tIapp_locale_leaks_page("t_c4b012f6")}
      title={tIapp_locale_leaks_page("t_2d4d4d1b")}
      sub={tIapp_locale_leaks_page("t_03cd5197")}
    >
      <div className="flex flex-wrap gap-3">
        <Link href="/money">
          <Button className="!text-[15px] !px-5 !py-3">
            {tIapp_locale_leaks_page("t_eec058aa")}
          </Button>
        </Link>
        <Link href="/cancel">
          <Button variant="ghost">{tIapp_locale_leaks_page("t_bc18d8da")}</Button>
        </Link>
      </div>

      <div className="grid gap-4 mt-10 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {ranked.map((l) => (
          <Link key={l.href + l.he} href={l.href} className="no-underline text-ink">
            <SpotlightCard
              className={`p-5 h-full hover:border-[rgba(63,203,155,0.45)] transition-colors ${
                spotlight.has(l.href) ? "border-[rgba(63,203,155,0.28)]" : ""
              }`}
            >
              {spotlight.has(l.href) && (
                <div className="text-[11px] font-extrabold text-emerald uppercase tracking-wide mb-1.5">
                  {tIapp_locale_leaks_page("t_f87fbdb7")}
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
          {tIapp_locale_leaks_page("t_4c7c9f63")}
        </div>
        <p className="text-ink-soft text-[14px] mt-3 max-w-[480px] mx-auto leading-relaxed">
          {tIapp_locale_leaks_page("t_ace971b5")}
        </p>
        <Link href="/money" className="inline-block mt-5">
          <Button>{tIapp_locale_leaks_page("t_7698572b")}</Button>
        </Link>
      </div>
    </VerticalPageShell>
  );
}
