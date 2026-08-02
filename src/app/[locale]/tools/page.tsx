import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ToolIcon } from "@/components/ToolIcon";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { CATEGORY_ORDER, toolsInCategory, type ToolCategory } from "@/lib/toolsCatalog";
import { alternateLanguages } from "@/lib/seo";
import { toolDisplayLabel } from "@/lib/toolLabels";

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
    <main className="max-w-[900px] mx-auto px-5 pb-24 pt-6">
      <Reveal>
        <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-4">
          {t("kicker")}
        </div>
        <h1 className="font-display text-[clamp(28px,5vw,42px)] leading-tight m-0">{t("title")}</h1>
        <p className="text-ink-soft text-[16px] leading-relaxed mt-4 max-w-[640px]">{t("sub")}</p>
      </Reveal>

      {CATEGORY_ORDER.map((cat, ci) => {
        const items = toolsInCategory(cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} className="mt-12">
            <Reveal delay={ci * 40}>
              <h2 className="font-display text-xl mb-4">{catTitle(cat)}</h2>
            </Reveal>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
              {items.map((tool, i) => (
                <Reveal key={tool.href} delay={i * 30}>
                  <Link href={tool.href} className="no-underline block h-full">
                    <SpotlightCard className="p-5 h-full hover:border-[rgba(63,203,155,0.35)] transition-colors">
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
    </main>
  );
}
