import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui";
import { CHANGELOG } from "@/lib/changelog";
import { publicPageMetadata } from "@/lib/seo";
import { bcp47, type Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "changelog" });
  return publicPageMetadata(locale, {
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/changelog",
  });
}

/** What shipped, newest first, grouped by the day it shipped. */
export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "changelog" });
  const he = locale === "he";
  const loc = bcp47[locale as Locale];

  const byDate = new Map<string, string[]>();
  for (const entry of CHANGELOG) {
    const list = byDate.get(entry.date) ?? [];
    list.push(he ? entry.he : entry.en);
    byDate.set(entry.date, list);
  }
  const dates = [...byDate.keys()].sort().reverse();

  return (
    <main className="max-w-[720px] mx-auto px-5 py-10">
      <h1 className="font-display text-h1 mt-0 mb-2">{t("title")}</h1>
      <p className="text-ink-soft text-body-lg mt-0 mb-7 leading-relaxed">{t("subtitle")}</p>

      <div className="flex flex-col gap-4">
        {dates.map((date) => (
          <Card key={date} className="p-5">
            <div className="text-caption text-ink-soft mb-3" dir="ltr">
              {new Date(`${date}T00:00:00Z`).toLocaleDateString(loc, {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </div>
            <ul className="list-disc p-0 m-0 ps-5 flex flex-col gap-2">
              {(byDate.get(date) ?? []).map((line) => (
                <li key={line} className="text-body-lg leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </main>
  );
}
