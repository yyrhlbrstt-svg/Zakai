import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button, Card } from "@/components/ui";
import { alternateLanguages, SITE_URL } from "@/lib/seo";
import { entitlementIdFromSlug, IL_RIGHT_SLUGS } from "@/lib/rightsSeo";
import { actionFor } from "@/lib/rightsActions";
import { activeLocales, type Locale } from "@/i18n/config";

type ItemCopy = { title: string; desc: string; how: string };

export function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = [];
  for (const locale of activeLocales) {
    for (const slug of IL_RIGHT_SLUGS) {
      params.push({ locale, slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const id = entitlementIdFromSlug(slug);
  if (!id) return { title: "Zakai" };
  const t = await getTranslations({ locale, namespace: "rights" });
  const item = t.raw(`items.${id}`) as ItemCopy | undefined;
  const title = item?.title ?? id;
  const description = item?.desc ?? "";
  const path = `/rights/${slug}`;
  return {
    title: `${title} — Zakai`,
    description,
    alternates: { languages: alternateLanguages(path) },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}${path}`,
      type: "article",
    },
  };
}

export default async function RightLandingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const id = entitlementIdFromSlug(slug);
  if (!id) notFound();

  setRequestLocale(locale as Locale);
  const t = await getTranslations("rights");
  const item = t.raw(`items.${id}`) as ItemCopy | undefined;
  if (!item?.title) notFound();

  const action = actionFor(id);
  const ctaHref = action?.tool ?? "/rights";
  const zmlId = id.startsWith("il_") ? id : `il_${id}`;

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-4">
      <p className="text-[12px] text-emerald font-extrabold m-0">{t("title")}</p>
      <h1 className="font-display text-[clamp(28px,4vw,36px)] mt-2 mb-3">{item.title}</h1>
      <p className="text-ink-soft text-[15px] leading-relaxed">{item.desc}</p>

      <Card className="p-5 mt-6">
        <div className="text-[13px] font-extrabold text-emerald mb-2">{t("howTo")}</div>
        <p className="text-[14px] leading-relaxed m-0">{item.how}</p>
      </Card>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link href={ctaHref}>
          <Button>{locale === "he" || locale === "ar" ? "התחל בזכאי" : "Start in Zakai"}</Button>
        </Link>
        <Link href="/rights">
          <Button variant="ghost">
            {locale === "he" || locale === "ar" ? "בדיקת כל הזכויות" : "Full rights check"}
          </Button>
        </Link>
      </div>

      <p className="text-[11.5px] text-ink-soft mt-8 leading-relaxed">{t("disclaimer")}</p>
      <p className="text-[11px] text-ink-soft mt-3">
        ZML:{" "}
        <a
          className="text-emerald"
          href={`/api/rights/catalog/${zmlId}?full=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {zmlId}
        </a>
      </p>
    </main>
  );
}
