import { setRequestLocale } from "next-intl/server";
import { VerifyLookup } from "@/components/VerifyLookup";

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
