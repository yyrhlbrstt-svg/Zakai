import { Card, Button } from "@/components/ui";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import {
  aggregateInboundPressure,
  disclosedInboundPressure,
  pressureRowsFromCases,
  CASE_PRESSURE_SELECT,
} from "@/lib/institutionInboundPressure";
import { institutionPilotMailto } from "@/lib/institutionPull";
import { loadInstitutionRiskTrend } from "@/lib/services/institutionRiskTrend";

export async function InstitutionInboundPressurePanel({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "institutions" });

  const [rows, trends] = await Promise.all([
    prisma.case
      .findMany({
        where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } },
        select: CASE_PRESSURE_SELECT,
      })
      .catch(() => [] as Parameters<typeof pressureRowsFromCases>[0]),
    loadInstitutionRiskTrend(),
  ]);

  const all = aggregateInboundPressure(pressureRowsFromCases(rows));
  const disclosed = disclosedInboundPressure(all);
  const mappedTotal = all.reduce((s, r) => s + r.dispatchedCases, 0);
  const trendByInstitution = new Map(trends.map((tr) => [tr.institutionId, tr]));

  return (
    <Card className="p-6 mb-4 border-[rgba(255,200,80,0.25)]">
      <h2 className="font-display text-xl mb-2">{t("inboundPressureTitle")}</h2>
      <p className="text-[14px] leading-relaxed text-ink-soft mb-4">{t("inboundPressureBody")}</p>

      <p className="text-[13px] font-bold m-0 mb-3">
        {t("inboundPressureMappedTotal", { count: mappedTotal })}
      </p>

      {disclosed.length === 0 ? (
        <p className="text-[13px] text-ink-soft m-0 mb-4">{t("inboundPressureEmpty")}</p>
      ) : (
        <ul className="list-none p-0 m-0 mb-4 flex flex-col gap-2 text-[13px]">
          {disclosed.slice(0, 5).map((row) => {
            const trend = trendByInstitution.get(row.institutionId);
            return (
              <li key={row.institutionId} className="flex justify-between gap-3 font-mono" dir="ltr">
                <span>{row.institutionId}</span>
                <span className="flex items-center gap-2">
                  {t("inboundPressureRow", {
                    dispatched: row.dispatchedCases,
                    saved: row.savedCases,
                  })}
                  {trend && trend.changePct !== null && trend.changePct !== 0 && (
                    <span
                      className={
                        trend.changePct > 0 ? "text-danger font-extrabold" : "text-emerald font-extrabold"
                      }
                    >
                      {t(trend.changePct > 0 ? "inboundPressureTrendUp" : "inboundPressureTrendDown", {
                        pct: Math.abs(trend.changePct),
                      })}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] p-4 mb-4">
        <h3 className="font-extrabold text-[15px] m-0 mb-2">{t("inboundPressureDeskTitle")}</h3>
        <p className="text-[13.5px] leading-relaxed text-ink-soft m-0 mb-3">{t("inboundPressureDeskBody")}</p>
        <div className="flex flex-col gap-2">
          <a href="/api/network/join-kit" className="no-underline">
            <Button variant="ghost" className="w-full !text-[13px]">
              {t("inboundPressureDeskStep1")}
            </Button>
          </a>
          <Link href="/institutions/leader" className="no-underline">
            <Button variant="ghost" className="w-full !text-[13px]">
              {t("inboundPressureDeskStep2")}
            </Button>
          </Link>
          <a href={institutionPilotMailto()} className="no-underline">
            <Button className="w-full !text-[13px]">{t("inboundPressureDeskStep3")}</Button>
          </a>
        </div>
      </div>

      <p className="text-[11.5px] text-ink-soft mt-2 mb-3 leading-relaxed">{t("inboundPressureDisclaimer")}</p>
      <div className="flex flex-wrap gap-4">
        <Link href="/institutions/leader" className="text-emerald font-bold no-underline">
          {t("leaderCtaLink")} →
        </Link>
        <a
          href="/api/institution/inbound-pressure"
          className="text-ink-soft font-bold no-underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("inboundPressureApi")} →
        </a>
        <a
          href="/api/institution/ignore-cost"
          className="text-ink-soft font-bold no-underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("ignoreCostApi")} →
        </a>
      </div>
    </Card>
  );
}
