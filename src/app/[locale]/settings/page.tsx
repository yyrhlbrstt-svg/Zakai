import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { LogoutButton } from "@/components/LogoutButton";
import { DeleteAccount } from "@/components/DeleteAccount";
import { ExportAccountButton } from "@/components/ExportAccountButton";
import { ReferralCard } from "@/components/ReferralCard";
import { TrackRecordCard } from "@/components/TrackRecordCard";
import { RecapCard } from "@/components/RecapCard";
import { REFERRAL_REWARD_AGOROT } from "@/lib/referral";
import { bcp47, type Locale } from "@/i18n/config";
import { privatePageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return privatePageMetadata(t("settings.t"));
}


/** The plan's translated name, or its raw value — never a thrown page. */
function planLabel(t: (k: string) => string, plan: string): string {
  try {
    return t(`planNames.${plan}`);
  } catch {
    return plan;
  }
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  const t = await getTranslations("settings");
  const tVisible = await getTranslations({ locale, namespace: "visibleWork" });
  const tCoupons = await getTranslations({ locale, namespace: "coupons" });
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_settings_page = await getTranslations({ locale, namespace: "inline_app_locale_settings_page" });

  const referral = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { referralCode: true, referralCreditAgorot: true },
  });
  const referralCount = await prisma.referralReward.count({ where: { referrerId: user!.id } });
  const consent = await prisma.consent.findFirst({
    where: { userId: user!.id, purpose: "terms_privacy_v1", revokedAt: null },
    orderBy: { grantedAt: "desc" },
  });
  const loc = bcp47[locale as Locale];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const invitePath = `/${locale}/signup?ref=${referral?.referralCode ?? ""}`;

  const rows = [
    { label: t("name"), value: user!.name, ltr: false },
    { label: t("email"), value: user!.email, ltr: true },
    { label: t("phone"), value: user!.phone, ltr: true },
    /*
      A missing plan name used to take the whole page down: the Plan enum
      gained BUSINESS and the catalogue did not, so every BUSINESS user got a
      crash instead of their settings. The key is added — and the lookup no
      longer trusts the catalogue to stay in step with the enum, because the
      next plan we add would break this the same way.
    */
    { label: t("plan"), value: planLabel(t, user!.plan), ltr: false },
    ...(consent
      ? [{ label: t("consent"), value: t("consentValue", { date: consent.grantedAt.toLocaleDateString(loc) }), ltr: false }]
      : []),
  ];

  return (
    <main className="max-w-[560px] mx-auto px-5 pb-20 pt-4">
      <h1 className="font-display text-[28px] mb-6">{t("title")}</h1>

      <Card className="p-6">
        <div className="text-[12px] font-extrabold text-ink-soft mb-3">
          {t("detailsTitle")}
        </div>
        <dl className="m-0">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className="flex justify-between gap-4 py-3"
              style={{
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.07)" : "none",
              }}
            >
              <dt className="text-ink-soft text-sm">{r.label}</dt>
              <dd className="m-0 text-[15px] font-bold text-end break-all">
                {r.ltr ? <span dir="ltr">{r.value}</span> : r.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <Link href="/pricing" className="text-emerald font-bold text-[13.5px] no-underline">
            {t("changePlan")}
          </Link>
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/activity">
          <Button variant="ghost" className="!text-body">
            {tVisible("title")}
          </Button>
        </Link>
        <Link href="/authority">
          <Button variant="ghost" className="!text-body">
            {tVisible("authorityLink")}
          </Button>
        </Link>
        <Link href="/coupons">
          <Button variant="ghost" className="!text-body">
            {tCoupons("title")}
          </Button>
        </Link>
        <Link href="/documents">
          <Button variant="ghost" className="!text-body">
            {tIapp_locale_settings_page("t_6c127838")}
          </Button>
        </Link>
        <Link href="/wrapped">
          <Button variant="ghost" className="!text-body">
            {tIapp_locale_settings_page("t_e2d56b43")}
          </Button>
        </Link>
        <Link href="/money">
          <Button variant="ghost" className="!text-body">
            {tIapp_locale_settings_page("t_bd4c0905")}
          </Button>
        </Link>
      </div>

      <div className="mt-6">
        <RecapCard referralCode={referral?.referralCode} bcp47={bcp47[locale as Locale]} />
      </div>

      <div className="mt-6">
        <ReferralCard
          path={invitePath}
          fallbackLink={`${appUrl}${invitePath}`}
          creditAgorot={referral?.referralCreditAgorot ?? 0}
          rewardAgorot={REFERRAL_REWARD_AGOROT}
          referralCount={referralCount}
          bcp47={bcp47[locale as Locale]}
        />
      </div>

      <div className="mt-6">
        <TrackRecordCard bcp47={bcp47[locale as Locale]} />
      </div>

      <div className="mt-6">
        <ExportAccountButton />
      </div>

      <div className="mt-6">
        <LogoutButton />
      </div>

      <div className="mt-6">
        <DeleteAccount />
      </div>
    </main>
  );
}
