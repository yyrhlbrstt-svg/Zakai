import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { listReceipts } from "@/lib/services/receipts";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { ReceiptCollector } from "@/components/ReceiptCollector";
import { planConfig } from "@/lib/plans";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "receipts" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: { languages: alternateLanguages("/receipts") },
  };
}

export const dynamic = "force-dynamic";

export default async function ReceiptsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login?return=/receipts", locale });

  const t = await getTranslations("receipts");
  const loc = bcp47[locale as Locale];
  const receipts = await listReceipts(user!.id);

  return (
    <VerticalPageShell heroGlow title={t("title")} sub={t("subtitle")}>
      <ReceiptCollector
        bcp47={loc}
        initialReceipts={receipts.map((r) => ({
          id: r.id,
          vendor: r.vendor,
          amountAgorot: r.amountAgorot,
          currency: r.currency,
          occurredAt: r.occurredAt ? r.occurredAt.toISOString() : null,
          category: r.category,
          hasVat: r.hasVat,
          flagged: r.flagged,
        }))}
        plan={planConfig(user!.plan).id}
      />
    </VerticalPageShell>
  );
}
