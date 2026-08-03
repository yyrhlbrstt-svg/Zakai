import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Button, Card } from "@/components/ui";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { alternateLanguages } from "@/lib/seo";
import {
  LIFE_SITUATIONS,
  STARTER_PACK,
  mustHavePageCopy,
  mustHaveSituationBlurb,
  mustHaveSituationTitle,
  mustHaveToolCost,
  mustHaveToolTitle,
} from "@/lib/monopoly/mustHaveKit";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const c = mustHavePageCopy(locale);
  return {
    title: `${c.title} | Zakai`,
    description: c.sub,
    alternates: { languages: alternateLanguages("/must-have") },
  };
}

export default async function MustHavePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = mustHavePageCopy(locale);

  return (
    <VerticalPageShell
      heroGlow
      width="wide"
      className="max-w-[880px] mx-auto px-5 pb-28 pt-4 relative"
      kicker={c.kicker}
      title={c.title}
      sub={c.sub}
    >
      <div className="flex flex-wrap gap-3 mb-10">
        <Link href="/money#zakai-money-scan">
          <Button className="!text-[15px] !px-6 !py-3">{c.ctaMoney}</Button>
        </Link>
        <Link href="/tools">
          <Button variant="ghost" className="!text-[14px]">
            {c.ctaTools}
          </Button>
        </Link>
      </div>

      <Reveal>
        <SectionHeading title={c.starterTitle} className="mt-0 mb-4" as="h2" />
      </Reveal>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] mb-12">
        {STARTER_PACK.map((tool, i) => (
          <Reveal key={tool.href} delay={i * 35}>
            <Link href={tool.href} className="no-underline block h-full">
              <Card className="p-5 h-full border-[rgba(63,203,155,0.28)] hover:border-[rgba(63,203,155,0.5)] transition-colors">
                <div className="font-extrabold text-[15px] text-ink">
                  {mustHaveToolTitle(tool, locale)}
                </div>
                <p className="text-[12.5px] text-ink-soft mt-2 mb-0 leading-relaxed">
                  {mustHaveToolCost(tool, locale)}
                </p>
                {tool.agentic ? (
                  <span className="inline-block mt-2.5 text-[10.5px] font-extrabold uppercase tracking-wide text-emerald border border-[rgba(63,203,155,0.35)] rounded-full px-2 py-0.5">
                    {c.agentBadge}
                  </span>
                ) : null}
              </Card>
            </Link>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <SectionHeading title={c.situationsTitle} className="mt-2 mb-6" as="h2" />
      </Reveal>
      <div className="flex flex-col gap-10">
        {LIFE_SITUATIONS.map((sit, si) => (
          <section key={sit.id}>
            <Reveal delay={si * 20}>
              <h3 className="font-extrabold text-[17px] m-0 mb-1">
                {mustHaveSituationTitle(sit, locale)}
              </h3>
              <p className="text-[13.5px] text-ink-soft m-0 mb-4 leading-relaxed">
                {mustHaveSituationBlurb(sit, locale)}
              </p>
            </Reveal>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
              {sit.tools.map((tool, i) => (
                <Reveal key={tool.href + sit.id} delay={i * 25}>
                  <Link href={tool.href} className="no-underline block h-full">
                    <Card className="p-4 h-full hover:border-[rgba(63,203,155,0.4)] transition-colors">
                      <div className="font-bold text-[14px] text-ink">
                        {mustHaveToolTitle(tool, locale)}
                      </div>
                      <p className="text-[12px] text-ink-soft mt-1.5 mb-0 leading-relaxed">
                        {mustHaveToolCost(tool, locale)}
                      </p>
                    </Card>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="text-[12.5px] text-ink-soft text-center mt-14 leading-relaxed max-w-[480px] mx-auto">
        {c.installHint}
      </p>
    </VerticalPageShell>
  );
}
