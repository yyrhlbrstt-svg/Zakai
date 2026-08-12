import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui";
import { loadServiceStatus, type StatusLevel } from "@/lib/services/serviceStatus";
import { publicPageMetadata } from "@/lib/seo";
import { bcp47, type Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "status" });
  return publicPageMetadata(locale, {
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/status",
  });
}

const DOT: Record<StatusLevel, string> = {
  up: "bg-emerald",
  degraded: "bg-[#e0b341]",
  down: "bg-[#ff8f8f]",
};

const HEAD: Record<StatusLevel, string> = {
  up: "text-emerald",
  degraded: "text-[#e0b341]",
  down: "text-[#ff8f8f]",
};

/**
 * The public status page.
 *
 * Every row is measured on the request that renders it — there is no cached
 * "operational" badge somebody has to remember to flip.
 */
export default async function StatusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "status" });
  const status = await loadServiceStatus();
  const loc = bcp47[locale as Locale];

  return (
    <main className="max-w-[720px] mx-auto px-5 py-10">
      <h1 className="font-display text-h1 mt-0 mb-2">{t("title")}</h1>
      <p className={`font-display text-h3 mt-0 mb-1 ${HEAD[status.overall]}`}>
        {t(`overall.${status.overall}`)}
      </p>
      <p className="text-ink-soft text-caption mt-0 mb-7" dir="ltr">
        {status.checkedAt.toLocaleString(loc)}
      </p>

      <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
        {status.rows.map((r) => (
          <li key={r.key}>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[r.level]}`} />
                <div className="min-w-0">
                  <div className="font-extrabold text-body-lg">{t(`row.${r.key}.title`)}</div>
                  <div className="text-caption text-ink-soft mt-1 leading-relaxed">
                    {t(`row.${r.key}.${r.level}`)}
                  </div>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <p className="text-caption text-ink-soft mt-7 mb-0 leading-relaxed">{t("footnote")}</p>
    </main>
  );
}
