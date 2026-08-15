import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { listAuthorities } from "@/lib/services/authorityControl";
import { AuthorityList } from "@/components/AuthorityList";
import { privatePageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Everything this person has authorised, and one tap to take it back.
 *
 * The screen the whole protocol exists to serve, and the last one to be built.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return privatePageMetadata(t("authority.t"));
}

export default async function AuthorityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login?return=/authority", locale });
    return null;
  }

  const t = await getTranslations({ locale, namespace: "authority" });
  const authorities = await listAuthorities(user.id);

  return (
    <main className="max-w-[760px] mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mt-0 mb-2">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] mt-0 mb-7 leading-relaxed">{t("subtitle")}</p>
      <AuthorityList authorities={authorities} />
    </main>
  );
}
