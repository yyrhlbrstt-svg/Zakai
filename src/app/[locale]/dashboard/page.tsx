import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";

const STATUS_KEY: Record<string, string> = {
  ANALYZED: "analyzed",
  APPROVED: "approved",
  VERIFIED: "verified",
  SENT: "sent",
  SAVED: "saved",
  NO_SAVING: "no_saving",
  REVOKED: "revoked",
};

const STATUS_COLOR: Record<string, string> = {
  ANALYZED: "#3EC6FF",
  APPROVED: "#3EC6FF",
  VERIFIED: "#8B5CF6",
  SENT: "#F0B45C",
  SAVED: "#2CE5A7",
  NO_SAVING: "#93A6A5",
  REVOKED: "#F08A6B",
};

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  const t = await getTranslations();
  const loc = bcp47[locale as Locale];

  const cases = await prisma.case.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    include: { savingsProof: true, fee: true },
  });

  const totalPotential = cases.reduce(
    (sum, c) => sum + Math.max(0, c.amountOriginal - c.targetAmount),
    0,
  );

  return (
    <main className="max-w-[900px] mx-auto px-5 pb-20 pt-1">
      <h1 className="font-display text-3xl my-3 mb-5">{t("dashboard.title")}</h1>

      {cases.length === 0 ? (
        <Card className="text-center px-8 py-14">
          <div className="text-[44px] mb-3.5">📭</div>
          <div className="font-display text-2xl">{t("dashboard.empty")}</div>
          <div className="text-ink-soft text-[14.5px] mt-2">{t("dashboard.emptySub")}</div>
          <Link href="/check">
            <Button className="mt-6">{t("home.cta")}</Button>
          </Link>
        </Card>
      ) : (
        <>
          <Card className="p-7 relative overflow-hidden">
            <div
              className="absolute -top-[70px] -start-[50px] w-60 h-60 rounded-full"
              style={{ background: "#2CE5A7", filter: "blur(80px)", opacity: 0.26 }}
              aria-hidden
            />
            <div className="relative">
              <div className="text-[13px] text-ink-soft font-bold">{t("dashboard.potential")}</div>
              <div className="font-display grad-text text-5xl mt-2">
                {formatAgorot(totalPotential, loc)} {t("common.perMonthTag")}
              </div>
              <div className="text-[12.5px] text-ink-soft mt-1.5">{t("dashboard.potentialSub")}</div>
            </div>
          </Card>

          <h2 className="text-[17px] font-extrabold mt-6 mb-3.5">{t("dashboard.checks")}</h2>
          <Card className="py-1.5">
            {cases.map((c, i) => {
              const settled = c.status === "SAVED" || c.status === "NO_SAVING";
              const effectiveNew = c.savingsProof ? c.savingsProof.newAmount : c.targetAmount;
              const delta = Math.max(0, c.amountOriginal - effectiveNew);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3.5 px-5 py-4 flex-wrap"
                  style={{
                    borderBottom: i < cases.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
                  }}
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
                    <span className="font-display grad-text text-lg">
                      {formatAgorot(effectiveNew, loc)}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-emerald font-extrabold">
                    −{formatAgorot(delta, loc)}
                    {c.status === "SAVED"
                      ? ` (${t("dashboard.verifiedSavedTag")})`
                      : !settled
                        ? ` (${t("dashboard.savedTag")})`
                        : ""}
                  </div>
                  {c.fee && c.fee.status !== "WAIVED" && (
                    <div className="text-[12px] text-ink-soft">
                      {t("dashboard.feeTag")}: {formatAgorot(c.fee.amount, loc)}
                    </div>
                  )}
                  <div
                    className="text-[11px] font-extrabold rounded-full px-2.5 py-1"
                    style={{
                      color: STATUS_COLOR[c.status],
                      background: `${STATUS_COLOR[c.status]}18`,
                      border: `1px solid ${STATUS_COLOR[c.status]}44`,
                    }}
                  >
                    {t(`dashboard.status.${STATUS_KEY[c.status]}`)}
                  </div>
                </div>
              );
            })}
          </Card>

          <div className="mt-6">
            <Link href="/check">
              <Button>{t("home.cta")}</Button>
            </Link>
          </div>
        </>
      )}

      <p className="mt-6 text-[11.5px] text-[rgba(147,166,165,0.6)]">
        {t("disclosure.agent")}
      </p>
    </main>
  );
}
