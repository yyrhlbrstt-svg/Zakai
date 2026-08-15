import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { Card, Button } from "@/components/ui";
import { planHasCouponVault } from "@/lib/coupons";
import { listCoupons } from "@/lib/services/couponVault";
import { CouponVault } from "@/components/CouponVault";
import { bcp47, type Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "coupons" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // A page of the person's own discount codes has no business in an index.
    robots: { index: false, follow: false },
  };
}

/**
 * The coupon vault — every discount this person holds, in one place.
 *
 * The gate is enforced twice on purpose: here, so a free account sees the
 * upsell instead of an empty vault, and again inside `addCoupon`, so the
 * screen not rendering is never the only thing stopping a write.
 */
export default async function CouponsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login?return=/coupons", locale });
    return null;
  }

  const t = await getTranslations({ locale, namespace: "coupons" });
  const allowed = planHasCouponVault(user.plan);

  return (
    <main className="max-w-[760px] mx-auto px-5 py-10">
      <h1 className="font-display text-h1 mt-0 mb-2">{t("title")}</h1>
      <p className="text-ink-soft text-body-lg mt-0 mb-7 leading-relaxed">{t("subtitle")}</p>

      {allowed ? (
        <CouponVault
          initial={(await listCoupons(user.id)).map((c) => ({
            ...c,
            expiresAt: c.expiresAt?.toISOString() ?? null,
            usedAt: c.usedAt?.toISOString() ?? null,
            createdAt: c.createdAt.toISOString(),
          }))}
          bcp47={bcp47[locale as Locale]}
        />
      ) : (
        <Card className="p-7">
          <h2 className="font-display text-title mt-0 mb-3">{t("locked.title")}</h2>
          <p className="text-ink-soft text-body-lg mt-0 mb-5 leading-relaxed">
            {t("locked.body")}
          </p>
          <Link href="/pricing" className="no-underline">
            <Button>{t("locked.cta")}</Button>
          </Link>
        </Card>
      )}
    </main>
  );
}
