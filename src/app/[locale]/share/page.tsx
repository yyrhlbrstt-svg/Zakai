import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Card, Button } from "@/components/ui";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface ShareParams {
  amount?: string;
  kicker?: string;
  sub?: string;
  ref?: string;
}

function ogUrl(locale: string, p: ShareParams): string {
  const qs = new URLSearchParams({ locale });
  if (p.amount) qs.set("amount", p.amount);
  if (p.kicker) qs.set("kicker", p.kicker);
  if (p.sub) qs.set("sub", p.sub);
  return `${SITE_URL}/api/og?${qs.toString()}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ShareParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "share" });
  const title = sp.amount ? t("landingTitleAmount", { amount: sp.amount }) : t("landingTitle");
  const image = ogUrl(locale, sp);
  return {
    title: `${title} | Zakai`,
    description: t("landingSub"),
    openGraph: {
      title: `${title} | Zakai`,
      description: t("landingSub"),
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Zakai`,
      description: t("landingSub"),
      images: [image],
    },
    robots: { index: false, follow: true },
  };
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ShareParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("share");

  const signupHref = sp.ref ? `/signup?ref=${encodeURIComponent(sp.ref)}` : "/signup";

  return (
    <main className="max-w-[560px] mx-auto px-5 pb-24 pt-10 text-center">
      <div className="text-body font-extrabold text-emerald tracking-wide uppercase mb-3">
        {sp.kicker || "Zakai"}
      </div>
      {sp.amount && (
        <div className="font-display grad-text text-[clamp(44px,12vw,72px)] leading-none mb-4">
          {sp.amount}
        </div>
      )}
      <Card className="p-7">
        <h1 className="font-display text-2xl mb-2">
          {sp.amount ? t("landingTitleAmount", { amount: sp.amount }) : t("landingTitle")}
        </h1>
        <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6">{t("landingSub")}</p>
        <div className="flex flex-col gap-2.5">
          <Link href={signupHref}>
            <Button className="w-full !text-[15px] !py-3">{t("landingCta")}</Button>
          </Link>
          <Link href="/check">
            <Button variant="ghost" className="w-full">
              {t("landingCheckCta")}
            </Button>
          </Link>
        </div>
      </Card>
      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.85)] leading-relaxed">
        {t("landingDisclaimer")}
      </p>
    </main>
  );
}
