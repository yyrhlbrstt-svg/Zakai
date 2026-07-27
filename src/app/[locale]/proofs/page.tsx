import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { formatAgorot } from "@/lib/money";
import { Card, Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "קיר החיסכונות — זכאי",
  description:
    "כמה נחסך השבוע עם סוכן זכאי — מספרים אנונימיים מתועדים, בלי פרטים אישיים.",
};

export const dynamic = "force-dynamic";

const VERTICAL_LABEL: Record<string, { he: string; en: string }> = {
  telecom: { he: "סלולר / אינטרנט", en: "Mobile / internet" },
  subscription: { he: "מנוי", en: "Subscription" },
  bank: { he: "בנק / עמלות", en: "Bank / fees" },
  insurance: { he: "ביטוח", en: "Insurance" },
  electricity: { he: "חשמל", en: "Electricity" },
  airline: { he: "טיסה", en: "Flight" },
  tax: { he: "מס", en: "Tax" },
  other: { he: "אחר", en: "Other" },
};

function verticalLabel(v: string, he: boolean): string {
  const row = VERTICAL_LABEL[v] ?? VERTICAL_LABEL.other;
  return he ? row.he : row.en;
}

export default async function ProofsWallPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";
  const loc = bcp47[locale as Locale];

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);

  const [weekAgg, monthAgg, totalPaid, recent] = await Promise.all([
    prisma.strategyOutcome.aggregate({
      where: { paid: true, createdAt: { gte: weekAgo } },
      _sum: { recoveredMinor: true },
      _count: true,
    }),
    prisma.strategyOutcome.aggregate({
      where: { paid: true, createdAt: { gte: monthAgo } },
      _sum: { recoveredMinor: true },
      _count: true,
    }),
    prisma.strategyOutcome.count({ where: { paid: true } }),
    prisma.strategyOutcome.findMany({
      where: { paid: true, recoveredMinor: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        vertical: true,
        counterparty: true,
        recoveredMinor: true,
        days: true,
        createdAt: true,
      },
    }),
  ]);

  // recoveredMinor is yearly-equivalent (monthly saving * 12) from recordSaving.
  const weekYearly = weekAgg._sum.recoveredMinor ?? 0;
  const monthYearly = monthAgg._sum.recoveredMinor ?? 0;
  const weekMonthly = Math.round(weekYearly / 12);
  const monthMonthly = Math.round(monthYearly / 12);

  return (
    <main className="max-w-[900px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {he ? "קיר חיסכונות · אנונימי" : "Savings wall · anonymous"}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,42px)] leading-tight m-0">
        {he ? "השבוע נחסך — בלי מוקד" : "Saved this week — no call center"}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mt-4 max-w-[640px]">
        {he
          ? "מספרים מצרפיים מ-StrategyOutcome בלבד. אין שמות, אין טלפונים, אין אימיילים — רק תוצאות מתועדות של הסוכן."
          : "Aggregate numbers from StrategyOutcome only. No names, phones, or emails — only documented agent outcomes."}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
        <Stat
          label={he ? "חיסכון חודשי · 7 ימים" : "Monthly · 7 days"}
          value={formatAgorot(weekMonthly, loc)}
        />
        <Stat
          label={he ? "תיקים שנסגרו · 7 ימים" : "Closed · 7 days"}
          value={String(weekAgg._count)}
        />
        <Stat
          label={he ? "חיסכון חודשי · 30 ימים" : "Monthly · 30 days"}
          value={formatAgorot(monthMonthly, loc)}
        />
        <Stat
          label={he ? "סה\"כ חיסכונות מתועדים" : "Total documented"}
          value={String(totalPaid)}
        />
      </div>

      <h2 className="text-[17px] font-extrabold mt-12 mb-4">
        {he ? "דוגמאות אחרונות (אנונימי)" : "Recent examples (anonymous)"}
      </h2>

      {recent.length === 0 ? (
        <Card className="p-6 text-ink-soft text-[14px] text-center">
          {he
            ? "עדיין אין תוצאות מתועדות בקנה-מידה. כל חיסכון שנסגר נכנס לכאן אוטומטית — בלי PII."
            : "No documented outcomes yet at scale. Every closed saving lands here automatically — no PII."}
        </Card>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {recent.map((r, i) => {
            const monthly = Math.round(r.recoveredMinor / 12);
            return (
              <SpotlightCard key={`${r.createdAt.toISOString()}-${i}`} className="p-4">
                <div className="text-[12px] font-extrabold text-emerald uppercase tracking-wide">
                  {verticalLabel(r.vertical, he)}
                </div>
                <div className="font-display text-2xl grad-text mt-1.5">
                  −{formatAgorot(monthly, loc)}
                  <span className="text-[12px] text-ink-soft font-sans"> /{he ? "ח׳" : "mo"}</span>
                </div>
                <div className="text-[12px] text-ink-soft mt-2">
                  {r.days > 0
                    ? he
                      ? `נסגר תוך ${r.days} ימים`
                      : `Closed in ${r.days} days`
                    : he
                      ? "נסגר"
                      : "Closed"}
                  {" · "}
                  {r.createdAt.toLocaleDateString(loc)}
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      )}

      <div className="mt-14 rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] px-6 py-8 text-center">
        <div className="font-display text-[clamp(20px,3.5vw,28px)]">
          {he ? "הבא ברשימה — אתה" : "Next on the list — you"}
        </div>
        <p className="text-ink-soft text-[14px] mt-3 max-w-[480px] mx-auto leading-relaxed">
          {he
            ? "סרוק חיובים, פתח תיק עם Mandate, תן לסוכן לעבוד. עמלה רק על חיסכון מתועד."
            : "Scan charges, open a Mandate case, let the agent work. Fee only on documented savings."}
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-5">
          <Link href="/money">
            <Button>{he ? "הכסף שלי" : "My money"}</Button>
          </Link>
          <Link href="/cancel">
            <Button variant="ghost">{he ? "ביטול מנוי" : "Cancel sub"}</Button>
          </Link>
          <Link href="/leaks">
            <Button variant="ghost">{he ? "מפת נזילות" : "Leaks map"}</Button>
          </Link>
        </div>
      </div>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.55)] text-center max-w-[520px] mx-auto">
        {he
          ? "הנתונים מגיעים מטבלת StrategyOutcome בלבד — ללא קישור למשתמש או תיק. זהו קיר אמון ציבורי, לא פרופיל אישי."
          : "Data comes only from the StrategyOutcome table — no link to a user or case. This is a public trust wall, not a personal profile."}
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 text-center">
      <div className="font-display text-[clamp(18px,3vw,26px)] grad-text leading-tight">{value}</div>
      <div className="text-[11.5px] text-ink-soft mt-1.5">{label}</div>
    </Card>
  );
}
