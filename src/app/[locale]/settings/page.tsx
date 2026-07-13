import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { Card } from "@/components/ui";
import { LogoutButton } from "@/components/LogoutButton";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  const t = await getTranslations("settings");

  const rows = [
    { label: t("name"), value: user!.name, ltr: false },
    { label: t("email"), value: user!.email, ltr: true },
    { label: t("phone"), value: user!.phone, ltr: true },
  ];

  return (
    <main className="max-w-[560px] mx-auto px-5 pb-20 pt-4">
      <h1 className="font-display text-[28px] mb-6">{t("title")}</h1>

      <Card className="p-6">
        <div className="text-[12px] font-extrabold text-ink-soft mb-3">
          {t("detailsTitle")}
        </div>
        <dl className="m-0">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className="flex justify-between gap-4 py-3"
              style={{
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.07)" : "none",
              }}
            >
              <dt className="text-ink-soft text-sm">{r.label}</dt>
              <dd className="m-0 text-[15px] font-bold text-end break-all">
                {/* email/phone are latin — isolate so they read cleanly in RTL */}
                {r.ltr ? <span dir="ltr">{r.value}</span> : r.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="mt-6">
        <LogoutButton />
      </div>
    </main>
  );
}
