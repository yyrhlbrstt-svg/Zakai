import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { alternateLanguages, SITE_URL } from "@/lib/seo";
import { Card } from "@/components/ui";
import { INTEROP_PROFILES } from "@/lib/protocol/interop";
import { Link } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "standard" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/standard") },
  };
}

export default async function StandardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "standard" });

  const interopUrl = `${SITE_URL}/.well-known/zakai-interop.json`;
  const probeUrl = `${SITE_URL}/api/interop?probe=1`;

  return (
    <VerticalPageShell title={t("title")} sub={t("sub")} width="wide">
      <Card className="p-5 mb-8 border-emerald/30">
        <p className="text-[14px] text-ink-soft m-0 mb-3 leading-relaxed">{t("startHere")}</p>
        <div className="flex flex-col gap-2 font-mono text-[12.5px] break-all">
          <a href={interopUrl} className="text-emerald font-bold no-underline hover:underline">
            {interopUrl}
          </a>
          <a href={probeUrl} className="text-ink-soft no-underline hover:text-emerald">
            {probeUrl}
          </a>
        </div>
      </Card>

      <h2 className="text-lg font-extrabold mb-4">{t("profilesTitle")}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 list-none p-0 m-0 mb-10">
        {INTEROP_PROFILES.map((p) => (
          <li key={p.id}>
            <Card className="p-4 h-full">
              <div className="text-[11px] font-mono text-emerald mb-1">{p.id}</div>
              <div className="font-bold text-[15px] mb-1">{p.title}</div>
              <p className="text-body text-ink-soft m-0 leading-relaxed">{p.summary}</p>
            </Card>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-4 text-body font-bold">
        <Link href="/integrations" className="text-emerald no-underline hover:underline">
          {t("ctaIntegrations")}
        </Link>
        <Link href="/institutions" className="text-ink-soft no-underline hover:text-emerald">
          {t("ctaInstitutions")}
        </Link>
        <Link href="/global" className="text-ink-soft no-underline hover:text-emerald">
          {t("ctaGlobal")}
        </Link>
      </div>
    </VerticalPageShell>
  );
}
