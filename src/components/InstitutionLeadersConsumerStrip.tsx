import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { institutionDisplayName } from "@/lib/referenceVerifier";

/** Consumer-facing hint: which banks opted into the public verifier leaders wall. */
export async function InstitutionLeadersConsumerStrip({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "institutionLeader" });

  let leaders: {
    institutionId: string;
    displayNameHe: string;
    displayNameEn: string;
    tier: string;
  }[] = [];
  try {
    leaders = await prisma.referenceVerifier.findMany({
      orderBy: { listedAt: "asc" },
      take: 8,
      select: {
        institutionId: true,
        displayNameHe: true,
        displayNameEn: true,
        tier: true,
      },
    });
  } catch {
    leaders = [];
  }

  if (leaders.length === 0) return null;

  return (
    <Card className="p-5 mb-6 border-[rgba(63,203,155,0.25)]">
      <p className="text-[13px] text-ink-soft m-0 mb-3 leading-relaxed">{t("consumerStripHint")}</p>
      <ul className="list-none p-0 m-0 flex flex-col gap-2">
        {leaders.map((r) => (
          <li key={r.institutionId} className="flex items-center justify-between gap-2 text-[14px]">
            <span className="font-bold">{institutionDisplayName(locale, r)}</span>
            <span className="text-[11px] text-emerald font-extrabold uppercase tracking-wide">
              {r.tier === "pioneer" ? t("tierPioneer") : t("tierReference")}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ink-soft mt-3 mb-0">{t("consumerStripDisclaimer")}</p>
      <Link href="/institutions/leaders" className="text-emerald font-bold text-[13px] no-underline mt-3 inline-block">
        {t("seeLeaders")} →
      </Link>
    </Card>
  );
}
