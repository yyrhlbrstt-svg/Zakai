import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/PasswordResetForms";
import { privatePageMetadata } from "@/lib/seo";

/**
 * The target of the link in the reset email. The token stays in the URL and is
 * never persisted client-side: it is single-use and short-lived, so the address
 * bar is where it lives and dies.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return privatePageMetadata(t("reset.t"));
}

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="max-w-[440px] mx-auto px-5 py-12">
      <ResetPasswordForm token={token ?? ""} />
    </main>
  );
}
