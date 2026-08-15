import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { loadVisibleWork } from "@/lib/services/visibleWork";
import { VisibleWorkLedger } from "@/components/VisibleWorkLedger";
import { bcp47, type Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "visibleWork" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: false },
  };
}

/**
 * Visible Work — every action taken in this person's name, in one place,
 * each one bound to the authority it was taken under and revocable from here.
 *
 * `/authority` answers "what may Zakai do". This answers "what has it done" —
 * and those are different questions, which is why they needed different pages.
 */
export default async function ActivityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login?return=/activity", locale });
    return null;
  }

  const t = await getTranslations({ locale, namespace: "visibleWork" });
  const ledger = await loadVisibleWork(user.id);

  return (
    <main className="max-w-[760px] mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mt-0 mb-2">{t("title")}</h1>
      <p className="text-ink-soft text-body-lg mt-0 mb-7 leading-relaxed">{t("subtitle")}</p>

      <VisibleWorkLedger
        rows={ledger.events.map((e) => ({ ...e, at: e.at.toISOString() }))}
        summary={{
          total: ledger.total,
          delivered: ledger.delivered,
          waiting: ledger.waiting,
          failed: ledger.failed,
          activeAuthorities: ledger.activeAuthorities,
          underRevokedAuthority: ledger.underRevokedAuthority,
        }}
        bcp47={bcp47[locale as Locale]}
      />

      <p className="text-body text-ink-soft mt-7 mb-0 leading-relaxed">
        {t("authorityHint")}{" "}
        <Link href="/authority" className="text-emerald font-bold no-underline">
          {t("authorityLink")}
        </Link>
      </p>
    </main>
  );
}
