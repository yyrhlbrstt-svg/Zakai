import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { alternateLanguages, defaultOpenGraph } from "@/lib/seo";
import { agentsPageCopy } from "@/lib/marketing/agentsPageCopy";
import { Link } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "agents" });
  const title = t("metaTitle");
  const description = t("metaDesc");
  return {
    title,
    description,
    alternates: { languages: alternateLanguages("/agents") },
    openGraph: defaultOpenGraph(locale, { title, description, path: "/agents" }),
  };
}

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const copy = agentsPageCopy(locale);
  const he = locale === "he" || locale === "ar";

  return (
    <VerticalPageShell
      heroGlow
      dir={he ? "rtl" : "ltr"}
      kicker={copy.kicker}
      title={copy.title}
      sub={copy.sub}
    >
      <div className="mb-6 rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] px-4 py-3 text-[13.5px] leading-relaxed">
        <strong className="text-emerald">{copy.inviteStrong}</strong> {copy.inviteRest}
      </div>

      {copy.sections.map((section) => (
        <Section key={section.heading} heading={section.heading}>
          {section.paragraphs.map((p) => (
            <p key={p} className="text-[14.5px] leading-relaxed mb-3">
              {p}
            </p>
          ))}
          {section.list && (
            <ul className="list-disc ps-5 flex flex-col gap-2 text-[14.5px] leading-relaxed">
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.code && (
            <pre className="bg-[#0d1117] text-[#e6edf3] text-[12.5px] leading-relaxed rounded-lg p-4 overflow-x-auto mb-4">
              {section.code.replace("{ORIGIN}", ORIGIN)}
            </pre>
          )}
          {section.footnote && (
            <p className="text-[13px] leading-relaxed mt-3 text-ink-soft">{section.footnote}</p>
          )}
        </Section>
      ))}

      <Section heading={he ? "קראו עוד" : "Read more"}>
        <div className="flex flex-wrap gap-4">
          <Link href="/institutions" className="text-emerald font-bold no-underline">
            {copy.readMore.institutions}
          </Link>
          <a
            href={`${ORIGIN}/.well-known/zakai-mandate.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-soft font-bold no-underline"
          >
            {copy.readMore.discovery}
          </a>
          <a
            href={`${ORIGIN}/api/mandate/openapi.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-soft font-bold no-underline"
          >
            {copy.readMore.openapi}
          </a>
        </div>
      </Section>
    </VerticalPageShell>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 mb-4">
      <h2 className="font-display text-xl mb-3">{heading}</h2>
      {children}
    </Card>
  );
}
