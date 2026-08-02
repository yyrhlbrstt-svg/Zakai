import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { EmeraldInfoPanel } from "@/components/EmeraldInfoPanel";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { formatAgorot } from "@/lib/money";
import { Card, Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inline_app_locale_proofs_page" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/proofs") },
  };
}

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
  const tIapp_locale_proofs_page = await getTranslations({ locale, namespace: "inline_app_locale_proofs_page" });
  const loc = bcp47[locale as Locale];

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);

  // A public wall with no auth gate has to degrade rather than 500 when the
  // database has a blip — the same reasoning /companies' loadStats() already
  // follows for the identical table. An empty wall reads as "nothing yet,"
  // which is honest; a crashed page reads as broken, which is worse.
  const [weekAgg, monthAgg, totalPaid, recent] = await Promise.all([
    prisma.strategyOutcome
      .aggregate({
        where: { paid: true, createdAt: { gte: weekAgo } },
        _sum: { recoveredMinor: true },
        _count: true,
      })
      .catch(() => ({ _sum: { recoveredMinor: null }, _count: 0 })),
    prisma.strategyOutcome
      .aggregate({
        where: { paid: true, createdAt: { gte: monthAgo } },
        _sum: { recoveredMinor: true },
        _count: true,
      })
      .catch(() => ({ _sum: { recoveredMinor: null }, _count: 0 })),
    prisma.strategyOutcome.count({ where: { paid: true } }).catch(() => 0),
    prisma.strategyOutcome
      .findMany({
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
      })
      .catch(() => []),
  ]);

  // recoveredMinor is yearly-equivalent (monthly saving * 12) from recordSaving.
  const weekYearly = weekAgg._sum.recoveredMinor ?? 0;
  const monthYearly = monthAgg._sum.recoveredMinor ?? 0;
  const weekMonthly = Math.round(weekYearly / 12);
  const monthMonthly = Math.round(monthYearly / 12);

  return (
    <VerticalPageShell
      heroGlow
      width="wide"
      className="max-w-[900px] mx-auto px-5 pb-24 pt-4 relative"
      kicker={tIapp_locale_proofs_page("t_d2c8fb14")}
      title={tIapp_locale_proofs_page("t_027aa200")}
      sub={tIapp_locale_proofs_page("t_3070dd2f")}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
        <Stat
          label={tIapp_locale_proofs_page("t_be944a54")}
          value={formatAgorot(weekMonthly, loc)}
        />
        <Stat
          label={tIapp_locale_proofs_page("t_7623b6d2")}
          value={String(weekAgg._count)}
        />
        <Stat
          label={tIapp_locale_proofs_page("t_06b88ed2")}
          value={formatAgorot(monthMonthly, loc)}
        />
        <Stat
          label={tIapp_locale_proofs_page("t_838cfd06")}
          value={String(totalPaid)}
        />
      </div>

      <h2 className="text-[17px] font-extrabold mt-12 mb-4">
        {tIapp_locale_proofs_page("t_a700ca87")}
      </h2>

      {recent.length === 0 ? (
        <Card className="p-6 text-ink-soft text-[14px] text-center">
          {tIapp_locale_proofs_page("t_152309da")}
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
                  <span className="text-[12px] text-ink-soft font-sans"> /{tIapp_locale_proofs_page("t_147726d1")}</span>
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

      <EmeraldInfoPanel className="mt-14 text-center px-6 py-8">
        <div className="font-display text-[clamp(20px,3.5vw,28px)]">
          {tIapp_locale_proofs_page("t_dee2cf67")}
        </div>
        <p className="text-ink-soft text-[14px] mt-3 max-w-[480px] mx-auto leading-relaxed">
          {tIapp_locale_proofs_page("t_8a82bb80")}
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-5">
          <Link href="/money">
            <Button>{tIapp_locale_proofs_page("t_bd4c0905")}</Button>
          </Link>
          <Link href="/cancel">
            <Button variant="ghost">{tIapp_locale_proofs_page("t_00a5e771")}</Button>
          </Link>
          <Link href="/leaks">
            <Button variant="ghost">{tIapp_locale_proofs_page("t_16c6cdf1")}</Button>
          </Link>
        </div>
      </EmeraldInfoPanel>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.55)] text-center max-w-[520px] mx-auto">
        {tIapp_locale_proofs_page("t_dfa51bd3")}
      </p>
    </VerticalPageShell>
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
