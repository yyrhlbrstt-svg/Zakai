import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { publicSupportEmail } from "@/lib/contact";
import { publicPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return publicPageMetadata(locale, {
    title: t("privacy.t"),
    description: t("privacy.d"),
    path: "/privacy",
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legalPages");
  const sections = t.raw("privacy") as Array<{ h: string; p: string }>;
  const supportEmail = publicSupportEmail();

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("privacyTitle")}</h1>
      <p className="text-ink-soft text-[12.5px] mb-6">{t("updated")}</p>
      <Card className="p-6 flex flex-col gap-5">
        {sections.map((s, i) => (
          <section key={s.h}>
            <h2 className="text-[15px] font-extrabold m-0 mb-1.5">
              {i + 1}. {s.h}
            </h2>
            <p className="text-ink-soft text-[13.5px] leading-relaxed m-0">
              {s.p.includes("{email}")
                ? t("privacyContact", { email: supportEmail })
                : s.p}
            </p>
          </section>
        ))}
      </Card>
      <p className="mt-5 text-body text-ink-soft">
        {t("privacyContact", { email: supportEmail })}
      </p>
      <p className="mt-3 text-[11.5px] text-ink-soft leading-relaxed">{t("legalNote")}</p>
    </main>
  );
}
