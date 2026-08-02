import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { alternateLanguages } from "@/lib/seo";
import { Link } from "@/i18n/routing";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { NumberedStepList } from "@/components/NumberedStepList";
import { EmeraldInfoPanel } from "@/components/EmeraldInfoPanel";
import { CodeBlock } from "@/components/CodeBlock";
import { SectionHeading } from "@/components/SectionHeading";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";

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
    <VerticalPageShell
      heroGlow
      kicker={t("kicker")}
      title={t("title")}
      sub={t("sub")}
    >
      <Reveal>
        <NumberedStepList
          steps={steps.map((s) => ({ title: s.title, body: s.body }))}
          variant="sections"
        />
      </Reveal>

      <Reveal delay={80}>
        <EmeraldInfoPanel className="mt-10">
          <strong className="text-emerald">{t("linksTitle")}</strong>
          <ul className="mt-2 mb-0 ps-5 list-disc flex flex-col gap-1.5">
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
        </EmeraldInfoPanel>
      </Reveal>

      <Reveal delay={100}>
        <SpotlightCard className="p-5 mt-8">
          <SectionHeading title={t("proofTitle")} className="mt-0 mb-2" as="h2" />
          <p className="text-[14px] text-ink-soft leading-relaxed m-0 mb-3">{t("proofBody")}</p>
          <CodeBlock>{`ORIGIN=${ORIGIN}\n${t("proofCurl")}`}</CodeBlock>
        </SpotlightCard>
      </Reveal>

      <Reveal delay={120}>
        <p className="text-[14px] text-ink-soft mb-4 mt-8">{t("moreDetail")}</p>
        <Link href="/institutions" className="text-emerald font-bold underline">
          {t("institutionsCta")}
        </Link>
      </Reveal>
    </VerticalPageShell>
  );
}
