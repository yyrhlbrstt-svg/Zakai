import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { CheckFlow } from "@/components/CheckFlow";
import { smtpFullyConfigured } from "@/lib/deploy/smtpConfigured";
import { aiAvailable } from "@/lib/ai";
import { privatePageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return privatePageMetadata(t("check.t"));
}

export default async function CheckPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login?return=/check", locale });
  // Real deliverability, not an assumption: with no SMTP the "send via Zakai"
  // button cannot reach anyone, and the self-send path has to lead instead.
  return <CheckFlow mailLive={smtpFullyConfigured()} aiLive={aiAvailable()} />;
}
