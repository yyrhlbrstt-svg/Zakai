import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerifyEmailScreen } from "@/components/VerifyEmailScreen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "verifyEmail" });
  // Never indexed: the URL carries a single-use token, and a crawler that
  // fetches it would consume somebody's link before they opened it.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("verifyEmail");

  return (
    <main className="max-w-[520px] mx-auto px-5 py-16">
      <h1 className="font-display text-2xl mt-0 mb-5 text-center">{t("title")}</h1>
      <Suspense fallback={null}>
        <VerifyEmailScreen />
      </Suspense>
    </main>
  );
}
