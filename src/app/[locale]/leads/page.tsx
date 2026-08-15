import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { privatePageMetadata } from "@/lib/seo";

/**
 * Folded into /founder — this page used to carry the full lead table while
 * /founder carried a 25-row preview of the same data, two half-built admin
 * views of one thing. /founder now has the full table (plus feedback, which
 * had no admin view at all). This redirect keeps old bookmarks working.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return privatePageMetadata(t("leads.t"));
}

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/founder", locale });
}
