import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/PasswordResetForms";
import { publicPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return publicPageMetadata(locale, {
    title: t("forgot.t"),
    description: t("forgot.d"),
    path: "/forgot",
  });
}

export default function ForgotPage() {
  return (
    <main className="max-w-[440px] mx-auto px-5 py-12">
      <ForgotPasswordForm />
    </main>
  );
}
