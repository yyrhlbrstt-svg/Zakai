import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legalPages");
  const sections = t.raw("terms") as Array<{ h: string; p: string }>;

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("termsTitle")}</h1>
      <p className="text-ink-soft text-[12.5px] mb-6">{t("updated")}</p>
      <Card className="p-6 flex flex-col gap-5">
        {sections.map((s, i) => (
          <section key={s.h}>
            <h2 className="text-[15px] font-extrabold m-0 mb-1.5">
              {i + 1}. {s.h}
            </h2>
            <p className="text-ink-soft text-[13.5px] leading-relaxed m-0">{s.p}</p>
          </section>
        ))}
      </Card>
      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("legalNote")}</p>
    </main>
  );
}
