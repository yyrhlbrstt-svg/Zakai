import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { CheckFlow } from "@/components/CheckFlow";

export default async function CheckPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });
  return <CheckFlow />;
}
