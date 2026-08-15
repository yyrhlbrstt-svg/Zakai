import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { privatePageMetadata } from "@/lib/seo";

/**
 * Title only. The page itself is a client component — it reads a one-time
 * token out of the URL — and a client component cannot export metadata, so
 * this is where the route's <title> lives.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return privatePageMetadata(t("saving_confirm.t"));
}

export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
