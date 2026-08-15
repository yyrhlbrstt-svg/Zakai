import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerifyLookup } from "@/components/VerifyLookup";
import { privatePageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return privatePageMetadata(t("verify.t"));
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { locale } = await params;
  const { code } = await searchParams;
  setRequestLocale(locale);
  return <VerifyLookup initialCode={code} />;
}
