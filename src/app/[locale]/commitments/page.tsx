import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { CommitmentsBoard } from "@/components/CommitmentsBoard";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "commitments" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/commitments") },
  };
}

/**
 * What you are committed to, and until when you can still get out.
 *
 * The rest of this product is episodic — somebody suspects, on a particular
 * day, that they are owed money. This is the part that is true every day
 * whether or not anyone opens the app, which is the only kind of thing
 * somebody keeps coming back to.
 *
 * The screen leads with what can still be acted on. A renewal date is not the
 * useful fact; the date notice must be given is, and it appears nowhere else
 * — not in the contract's headline, not in a calendar, not in any reminder
 * anyone sets.
 */
export default async function CommitmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "commitments" });

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")}>
      <div className="mt-8">
        <CommitmentsBoard locale={locale} />
      </div>
      <p className="mt-8 text-micro text-ink-soft leading-relaxed max-w-[560px]">
        {t("footnote")}
      </p>
    </VerticalPageShell>
  );
}
