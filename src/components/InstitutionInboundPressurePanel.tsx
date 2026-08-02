import { Card } from "@/components/ui";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import {
  aggregateInboundPressure,
  disclosedInboundPressure,
  pressureRowsFromCases,
  CASE_PRESSURE_SELECT,
} from "@/lib/institutionInboundPressure";

export async function InstitutionInboundPressurePanel({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "institutions" });

  const rows = await prisma.case
    .findMany({
      where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } },
      select: CASE_PRESSURE_SELECT,
    })
    .catch(() => [] as Parameters<typeof pressureRowsFromCases>[0]);

  const disclosed = disclosedInboundPressure(aggregateInboundPressure(pressureRowsFromCases(rows)));

  return (
    <Card className="p-6 mb-4 border-[rgba(255,200,80,0.25)]">
      <h2 className="font-display text-xl mb-2">{t("inboundPressureTitle")}</h2>
      <p className="text-[14px] leading-relaxed text-ink-soft mb-4">{t("inboundPressureBody")}</p>

      {disclosed.length === 0 ? (
        <p className="text-[13px] text-ink-soft m-0">{t("inboundPressureEmpty")}</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2 text-[13px]">
          {disclosed.slice(0, 5).map((row) => (
            <li key={row.institutionId} className="flex justify-between gap-3 font-mono" dir="ltr">
              <span>{row.institutionId}</span>
              <span>
                {t("inboundPressureRow", {
                  dispatched: row.dispatchedCases,
                  saved: row.savedCases,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11.5px] text-ink-soft mt-4 mb-3 leading-relaxed">{t("inboundPressureDisclaimer")}</p>
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
      </div>
    </Card>
  );
}
