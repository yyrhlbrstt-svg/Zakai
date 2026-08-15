import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { CATALOG } from "@/lib/priority";
import { alternateLanguages } from "@/lib/seo";

/** Agent doors worth paid/social campaign landings (short URLs + ?pref= attribution). */
const CAMPAIGN_DOORS = [
  "money",
  "cancel",
  "check",
  "bank-fees",
  "electricity",
  "warranty",
  "deposit",
  "duplicate-insurance",
  "flights",
  "leaks",
] as const;

type CampaignDoor = (typeof CAMPAIGN_DOORS)[number];

function isCampaignDoor(d: string): d is CampaignDoor {
  return (CAMPAIGN_DOORS as readonly string[]).includes(d);
}

export function generateStaticParams() {
  return CAMPAIGN_DOORS.map((door) => ({ door }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; door: string }>;
}): Promise<Metadata> {
  const { locale, door } = await params;
  if (!isCampaignDoor(door)) return {};
  const action = CATALOG.find((a) => a.id === door || a.href === `/${door}`);
  const title = locale === "he" || locale === "ar" ? action?.titleHe : action?.titleEn;
  const t = await getTranslations({ locale, namespace: "campaignGo" });
  return {
    title: title ? `${title} | Zakai` : t("metaTitle"),
    description: action?.whyEn ?? t("metaDesc"),
    alternates: { languages: alternateLanguages(`/go/${door}`) },
  };
}

export default async function CampaignGoPage({
  params,
}: {
  params: Promise<{ locale: string; door: string }>;
}) {
  const { locale, door } = await params;
  if (!isCampaignDoor(door)) notFound();
  setRequestLocale(locale);

  const action = CATALOG.find((a) => a.id === door || a.href === `/${door}`);
  if (!action) notFound();

  const he = locale === "he" || locale === "ar";
  const t = await getTranslations("campaignGo");
  const title = he ? action.titleHe : action.titleEn;
  const why = he ? action.whyHe : action.whyEn;

  return (
    <VerticalPageShell
      heroGlow
      width="narrow"
      className="max-w-[640px] mx-auto px-5 pb-24 pt-4"
      kicker={t("kicker")}
      title={title}
      sub={why}
    >
      <p className="text-body text-ink-soft leading-relaxed -mt-2 mb-6">{t("trust")}</p>
      <Link href={action.href}>
        <Button className="w-full !text-[16px] !py-3.5">{t("cta")}</Button>
      </Link>
      <p className="text-[11.5px] text-ink-soft mt-6 text-center leading-relaxed">{t("disclaimer")}</p>
      <p className="text-[11px] text-ink-soft mt-4 text-center leading-relaxed opacity-70">
        {t("attribHint")}
      </p>
    </VerticalPageShell>
  );
}
