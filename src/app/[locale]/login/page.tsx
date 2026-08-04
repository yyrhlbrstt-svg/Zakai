import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { AuthForm } from "@/components/AuthForm";
import { postAuthDestination } from "@/lib/services/postAuthDestination";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (user) {
    const href = await postAuthDestination(user.id);
    redirect({ href, locale });
  }
  return <AuthForm mode="login" />;
}
