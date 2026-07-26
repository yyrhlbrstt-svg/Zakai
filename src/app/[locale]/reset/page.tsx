import { ResetPasswordForm } from "@/components/PasswordResetForms";

/**
 * The target of the link in the reset email. The token stays in the URL and is
 * never persisted client-side: it is single-use and short-lived, so the address
 * bar is where it lives and dies.
 */
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
