import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ToolIcon } from "@/components/ToolIcon";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { SectionHeading } from "@/components/SectionHeading";
import { CATEGORY_ORDER, toolsInCategory, type ToolCategory } from "@/lib/toolsCatalog";
import { STARTER_PACK, mustHavePageCopy, mustHaveToolTitle } from "@/lib/monopoly/mustHaveKit";
import { alternateLanguages } from "@/lib/seo";
import { toolDisplayLabel } from "@/lib/toolLabels";
import { Button, Card } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "toolsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/tools") },
  };
}

export default async function ToolsHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("toolsPage");
  const nav = await getTranslations("nav");
  const he = locale === "he" || locale === "ar";

  function label(key: string) {
    return toolDisplayLabel(key, he, (k) => nav(k as "money"));
  }

  const catTitle = (c: ToolCategory) => t(`categories.${c}`);

  return (
    <VerticalPageShell
      heroGlow
      width="wide"
      className="max-w-[900px] mx-auto px-5 pb-24 pt-6 relative"
      kicker={t("kicker")}
      title={t("title")}
      sub={t("sub")}
    >
      <Reveal>
        <div className="mb-10 rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] p-5">
          <div className="font-extrabold text-[16px] mb-1">{mustHavePageCopy(locale).kicker}</div>
          <p className="text-[13.5px] text-ink-soft m-0 mb-4 leading-relaxed">
            {mustHavePageCopy(locale).sub}
          </p>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] mb-4">
            {STARTER_PACK.slice(0, 4).map((tool) => (
              <Link key={tool.href} href={tool.href} className="no-underline">
                <Card className="p-3.5 h-full !rounded-xl">
                  <div className="font-bold text-[13.5px] text-ink">
                    {mustHaveToolTitle(tool, locale)}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <Link href="/must-have">
            <Button className="!text-[13px]">{mustHavePageCopy(locale).starterTitle}</Button>
          </Link>
        </div>
      </Reveal>

      {CATEGORY_ORDER.map((cat, ci) => {
        const items = toolsInCategory(cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} className="mt-10 first:mt-2">
            <Reveal delay={ci * 40}>
              <SectionHeading title={catTitle(cat)} className="mt-0 mb-4" as="h2" />
            </Reveal>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
              {items.map((tool, i) => (
                <Reveal key={tool.href} delay={i * 30}>
                  <Link href={tool.href} className="no-underline block h-full group">
                    <SpotlightCard className="p-5 h-full border-[rgba(255,255,255,0.08)] group-hover:border-[rgba(63,203,155,0.35)] transition-[border-color,transform] duration-[var(--dur)] group-hover:-translate-y-0.5">
                      <div className="flex items-start gap-3">
                        <ToolIcon name={tool.key} size={22} className="text-emerald shrink-0 mt-0.5" />
                        <div>
                          <div className="font-extrabold text-[15px] text-ink">{label(tool.key)}</div>
                          {tool.agentic && (
                            <span className="inline-block mt-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-emerald border border-[rgba(63,203,155,0.35)] rounded-full px-2 py-0.5">
                              {t("agentBadge")}
                            </span>
                          )}
                        </div>
                      </div>
                    </SpotlightCard>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        );
      })}

      <Reveal>
        <p className="text-[13px] text-ink-soft mt-14 text-center max-w-[520px] mx-auto leading-relaxed">
          {t("footer")}
        </p>
      </Reveal>
    </VerticalPageShell>
  );
}
