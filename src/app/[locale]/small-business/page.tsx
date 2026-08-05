import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PageKicker } from "@/components/PageKicker";
import { Reveal } from "@/components/Reveal";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Button } from "@/components/ui";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "smallBusiness" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/small-business") },
  };
}

export default async function SmallBusinessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("smallBusiness");
  const tools = t.raw("tools") as Array<{ href: string; title: string; sub: string }>;

  return (
    <main className="max-w-[860px] mx-auto px-5 pb-24 pt-6">
      <Reveal>
        <PageKicker>{t("kicker")}</PageKicker>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="font-display text-[clamp(28px,4.8vw,44px)] leading-[1.15] m-0 text-balance">
          {t("title")}
        </h1>
      </Reveal>
      <Reveal delay={160}>
        <p className="text-ink-soft text-[16px] leading-[1.7] my-6 max-w-[600px]">{t("sub")}</p>
      </Reveal>
      <Reveal delay={200}>
        <p className="text-[12.5px] text-ink-soft mb-10">
          {t("notEmployeeBenefitNote")}{" "}
          <Link href="/business" className="text-emerald font-bold no-underline">
            {t("notEmployeeBenefitLink")}
          </Link>
        </p>
      </Reveal>

      <Reveal>
        <h2 className="text-[17px] font-extrabold mb-4">{t("toolsTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {tools.map((tool, i) => (
          <Reveal key={tool.href} delay={i * 70}>
            <Link href={tool.href} className="no-underline block h-full">
              <SpotlightCard className="p-5 h-full">
                <div className="font-extrabold text-[15px]">{tool.title}</div>
                <div className="text-ink-soft text-[12.5px] mt-1.5 leading-relaxed">{tool.sub}</div>
              </SpotlightCard>
            </Link>
          </Reveal>
        ))}
      </div>

      <Reveal delay={280}>
        <div className="mt-10">
          <Link href="/receipts" className="no-underline">
            <Button className="!px-7 !py-3.5 !text-[15px]">{t("cta")}</Button>
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
