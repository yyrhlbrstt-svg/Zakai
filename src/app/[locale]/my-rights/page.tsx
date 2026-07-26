import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { evaluateRights, type RightsProfile } from "@/lib/rights";
import { computeEntitlementInsights, profileFromRow } from "@/lib/entitlementInsights";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "הזכויות שלי — זכאי",
  description: "כל הזכויות, התיקים והחיסכון הפוטנציאלי שלך במקום אחד.",
};

const STATUS_KEY: Record<string, string> = {
  ANALYZED: "analyzed",
  APPROVED: "approved",
  VERIFIED: "verified",
  SENT: "sent",
  SAVED: "saved",
  NO_SAVING: "no_saving",
  REVOKED: "revoked",
};

export default async function MyRightsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  const t = await getTranslations();
  const loc = bcp47[locale as Locale];

  const userId = user!.id;
  const [cases, profileRow] = await Promise.all([
    prisma.case.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { savingsProof: true, fee: true },
    }),
    prisma.userRightsProfile.findUnique({ where: { userId } }),
  ]);

  const profile: RightsProfile | null = profileRow ? profileFromRow(profileRow) : null;
  const insights = profile ? computeEntitlementInsights(profile) : [];
  const totalPotential = insights.reduce((s, i) => s + (i.params.yearly ?? 0), 0);

  const documentedSaving = cases.reduce(
    (sum, c) => sum + (c.savingsProof?.savingMonthly ?? 0),
    0,
  );

  const pendingCases = cases.filter((c) => c.status !== "SAVED" && c.status !== "NO_SAVING" && c.status !== "REVOKED");
  const savedCases = cases.filter((c) => c.status === "SAVED");

  return (
    <main className="max-w-[900px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("myRights.title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[560px]">
        {t("myRights.subtitle")}
      </p>

      <Reveal>
        <SpotlightCard className="p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <div className="text-[12.5px] text-ink-soft font-bold">{t("myRights.potentialYearly")}</div>
              <div className="font-display grad-text text-3xl mt-1">
                {formatAgorot(totalPotential, loc)}
              </div>
            </div>
            <div>
              <div className="text-[12.5px] text-ink-soft font-bold">{t("myRights.documentedMonthly")}</div>
              <div className="font-display text-2xl text-emerald mt-1">
                {formatAgorot(documentedSaving, loc)}
              </div>
            </div>
            <div>
              <div className="text-[12.5px] text-ink-soft font-bold">{t("myRights.activeCases")}</div>
              <div className="font-display text-2xl mt-1">{pendingCases.length}</div>
            </div>
          </div>
        </SpotlightCard>
      </Reveal>

      <h2 className="text-[17px] font-extrabold mt-7 mb-3.5">{t("myRights.eligibleRights")}</h2>
      {insights.length === 0 ? (
        <Card className="px-6 py-8 text-center">
          <div className="text-ink-soft text-[14.5px]">{t("myRights.noProfile")}</div>
          <Link href="/entitlements">
            <Button className="mt-4">{t("myRights.fillProfile")}</Button>
          </Link>
        </Card>
      ) : (
        <Card className="py-1.5">
          {insights.slice(0, 8).map((insight, i) => (
            <Link
              key={insight.key}
              href={insight.href}
              className="flex items-center justify-between gap-3 px-5 py-4 no-underline hover:bg-white/5 transition-colors"
              style={{
                borderBottom: i < Math.min(insights.length, 8) - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
              }}
            >
              <div>
                <div className="font-extrabold text-[15px]">{t(`assistant.insights.${insight.key}`)}</div>
                <div className="text-xs text-ink-soft mt-0.5">
                  {insight.params.yearly
                    ? t("myRights.upToYearly", { amount: formatAgorot(insight.params.yearly, loc) })
                    : t("myRights.eligible")}
                </div>
              </div>
              <div className="text-emerald text-sm font-extrabold shrink-0">{t("myRights.check")} →</div>
            </Link>
          ))}
        </Card>
      )}

      <h2 className="text-[17px] font-extrabold mt-7 mb-3.5">{t("myRights.cases")}</h2>
      {cases.length === 0 ? (
        <Card className="px-6 py-8 text-center">
          <div className="text-ink-soft text-[14.5px]">{t("myRights.noCases")}</div>
          <Link href="/check">
            <Button className="mt-4">{t("home.cta")}</Button>
          </Link>
        </Card>
      ) : (
        <Card className="py-1.5">
          {cases.map((c, i) => {
            const effectiveNew = c.savingsProof ? c.savingsProof.newAmount : c.targetAmount;
            const delta = Math.max(0, c.amountOriginal - effectiveNew);
            return (
              <Link
                key={c.id}
                href={`/dashboard`}
                className="flex items-center gap-3.5 px-5 py-4 flex-wrap no-underline hover:bg-white/5 transition-colors"
                style={{ borderBottom: i < cases.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none" }}
              >
                <div className="flex-1 basis-[140px]">
                  <div className="font-extrabold text-[15.5px]">{t(`providers.${c.provider}`)}</div>
                  <div className="text-xs text-ink-soft mt-0.5">
                    {c.createdAt.toLocaleDateString(loc)}
                  </div>
                </div>
                <div className="text-[14.5px]">
                  <span className="font-display text-lg">{formatAgorot(c.amountOriginal, loc)}</span>
                  <span className="text-ink-soft"> → </span>
                  <span className="font-display grad-text text-lg">{formatAgorot(effectiveNew, loc)}</span>
                </div>
                <div className="text-[12.5px] text-emerald font-extrabold">−{formatAgorot(delta, loc)}</div>
                <div
                  className="text-[11px] font-extrabold rounded-full px-2.5 py-1"
                  style={{
                    color: c.status === "SAVED" ? "#3FCB9B" : "#3EC6FF",
                    background: `${c.status === "SAVED" ? "#3FCB9B" : "#3EC6FF"}18`,
                  }}
                >
                  {t(`dashboard.status.${STATUS_KEY[c.status]}`)}
                </div>
              </Link>
            );
          })}
        </Card>
      )}

      {savedCases.length > 0 && (
        <div className="mt-6">
          <Link href="/check">
            <Button>{t("myRights.checkAgain")}</Button>
          </Link>
        </div>
      )}
    </main>
  );
}
