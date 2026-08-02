import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { alternateLanguages } from "@/lib/seo";
import { Link } from "@/i18n/routing";

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "integrations" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/integrations") },
  };
}

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("integrations");
  const steps = t.raw("steps") as { title: string; body: string }[];

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-4" dir={locale === "he" || locale === "ar" ? "rtl" : "ltr"}>
      <p className="text-[12px] uppercase tracking-wide text-emerald font-bold mb-2">{t("kicker")}</p>
      <h1 className="font-display text-[32px] mb-3">{t("title")}</h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-8 max-w-[620px]">{t("sub")}</p>

      <div className="flex flex-col gap-5 mb-10">
        {steps.map((s, i) => (
          <section
            key={s.title}
            className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] p-5"
          >
            <div className="text-[12px] font-extrabold text-emerald mb-1">
              {t("stepLabel", { n: i + 1 })}
            </div>
            <h2 className="font-display text-lg m-0 mb-2">{s.title}</h2>
            <p className="text-[14px] text-ink-soft leading-relaxed m-0 whitespace-pre-line">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] px-4 py-4 text-[13.5px] leading-relaxed mb-8">
        <strong className="text-emerald">{t("linksTitle")}</strong>
        <ul className="mt-2 mb-0 pl-5 list-disc flex flex-col gap-1.5">
          <li>
            <a className="text-emerald underline break-all" href={`${ORIGIN}/.well-known/zakai-mandate.json`}>
              zakai-mandate.json
            </a>
          </li>
          <li>
            <a className="text-emerald underline break-all" href={`${ORIGIN}/.well-known/zakai-trust-registry.json`}>
              zakai-trust-registry.json
            </a>
          </li>
          <li>
            <a className="text-emerald underline break-all" href={`${ORIGIN}/api/network/opportunity-map`}>
              /api/network/opportunity-map
            </a>
          </li>
          <li>
            <a className="text-emerald underline break-all" href={`${ORIGIN}/api/network/readiness`}>
              /api/network/readiness
            </a>
          </li>
        </ul>
      </div>

      <p className="text-[14px] text-ink-soft mb-4">{t("moreDetail")}</p>
      <Link href="/institutions" className="text-emerald font-bold underline">
        {t("institutionsCta")}
      </Link>
    </main>
  );
}
