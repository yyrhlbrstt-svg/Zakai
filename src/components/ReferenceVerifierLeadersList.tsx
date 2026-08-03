import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { getTranslations } from "next-intl/server";
import { institutionDisplayName } from "@/lib/referenceVerifier";
import { institutionPilotMailto } from "@/lib/institutionPull";
import { Link } from "@/i18n/routing";

export async function ReferenceVerifierLeadersList({
  locale,
}: {
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "institutionLeader" });

  let rows: {
    institutionId: string;
    displayNameHe: string;
    displayNameEn: string;
    tier: string;
    listedAt: Date;
  }[] = [];
  try {
    rows = await prisma.referenceVerifier.findMany({
      orderBy: [{ tier: "asc" }, { listedAt: "asc" }],
      take: 50,
    });
  } catch {
    rows = [];
  }

  const pioneers = rows.filter((r) => r.tier === "pioneer");
  const reference = rows.filter((r) => r.tier !== "pioneer");

  if (rows.length === 0) {
    const pioneerLeft = 3;
    return (
      <Card className="p-6 mt-6">
        <p className="text-[14px] text-ink-soft m-0 mb-3">{t("leadersEmpty")}</p>
        <p className="text-[13px] text-emerald font-extrabold m-0 mb-4">
          {t("leadersEmptySlots", { n: pioneerLeft })}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/institutions/leader" className="no-underline">
            <Button>{t("leaderProgramCta")}</Button>
          </Link>
          <a href={institutionPilotMailto()} className="no-underline">
            <Button variant="ghost">{t("leadersClaimPioneer")}</Button>
          </a>
        </div>
      </Card>
    );
  }

  const renderRow = (r: (typeof rows)[number]) => (
    <li
      key={r.institutionId}
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 border-b border-[rgba(255,255,255,0.06)] last:border-0"
    >
      <div>
        <span className="font-bold text-[15px]">{institutionDisplayName(locale, r)}</span>
        <span className="text-[12px] text-ink-soft ms-2 font-mono" dir="ltr">
          {r.institutionId}
        </span>
      </div>
      <span className="text-[12px] text-emerald font-bold">
        {r.tier === "pioneer" ? t("tierPioneer") : t("tierReference")}
      </span>
    </li>
  );

  return (
    <div className="mt-6 flex flex-col gap-4">
      {pioneers.length > 0 && (
        <Card className="p-6">
          <h2 className="font-display text-lg m-0 mb-2">{t("leadersPioneerHeading")}</h2>
          <p className="text-[13px] text-ink-soft mb-4">{t("leadersPioneerSub")}</p>
          <ul className="list-none p-0 m-0">{pioneers.map(renderRow)}</ul>
        </Card>
      )}
      {reference.length > 0 && (
        <Card className="p-6">
          <h2 className="font-display text-lg m-0 mb-2">{t("leadersReferenceHeading")}</h2>
          <ul className="list-none p-0 m-0">{reference.map(renderRow)}</ul>
        </Card>
      )}
    </div>
  );
}
