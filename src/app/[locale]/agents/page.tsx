import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { alternateLanguages, defaultOpenGraph } from "@/lib/seo";
import { agentsPageCopy } from "@/lib/marketing/agentsPageCopy";
import { textDirection } from "@/lib/textDirection";
import { Link } from "@/i18n/routing";
import { MandateConsole } from "@/components/MandateConsole";
import { DelegationApplyForm } from "@/components/DelegationApplyForm";

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
  const dir = textDirection(locale);

  return (
    <VerticalPageShell
      heroGlow
      dir={dir}
      kicker={copy.kicker}
      title={copy.title}
      sub={copy.sub}
    >
      <div className="mb-6 rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] px-4 py-3 text-[13.5px] leading-relaxed">
        <strong className="text-emerald">{copy.inviteStrong}</strong> {copy.inviteRest}
      </div>

      <MandateConsole he={locale === "he"} />

      {/* Immediately after the console, and deliberately not on another page.
          This form existed only inside a section of /institutions, so a
          developer who had just watched the protocol work here had nothing to
          click and no idea a key was obtainable at all. The most valuable
          action on the page was the one action missing from it. */}
      <Card className="p-6 mb-4 border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.06)]">
        <h2 className="font-display text-h4 mt-0 mb-2">
          {locale === "he" ? "לקבל מפתח ולהתחיל להנפיק" : "Get a key and start issuing"}
        </h2>
        <p className="text-body text-ink-soft leading-relaxed mb-1">
          {locale === "he"
            ? "הסביבה למעלה פתוחה לכולם ולא דורשת כלום. מפתח אמיתי הוא מה שמאפשר להנפיק Mandate שמוסד יכול לאמת — ובקשה עוברת בדיקה אנושית לפני שמפתח נוצר."
            : "The sandbox above needs nothing. A real key is what lets you issue mandates an institution can verify — and every request is reviewed by a person before a key is minted."}
        </p>
        <p className="text-caption text-ink-soft mb-4">
          {locale === "he"
            ? "אין עלות לבקש, ואין מכירה אחרי זה."
            : "No cost to ask, and no sales follow-up."}
        </p>
        <DelegationApplyForm />
      </Card>

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
                <li key={item}>{item.split("{ORIGIN}").join(ORIGIN)}</li>
              ))}
            </ul>
          )}
          {section.code && (
            <pre tabIndex={0} className="bg-[#0d1117] text-[#e6edf3] text-[12.5px] leading-relaxed rounded-lg p-4 overflow-x-auto mb-4">
              {section.code.replace("{ORIGIN}", ORIGIN)}
            </pre>
          )}
          {section.footnote && (
            <p className="text-body leading-relaxed mt-3 text-ink-soft">{section.footnote}</p>
          )}
        </Section>
      ))}

      <Section heading={copy.readMoreHeading}>
        <div className="flex flex-wrap gap-4">
          <Link href="/pipe" className="text-emerald font-bold no-underline">
            {copy.readMore.pipe}
          </Link>
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
          <a
            href={`${ORIGIN}/.well-known/zakai-agent-economy.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-soft font-bold no-underline"
          >
            {copy.readMore.agentEconomy}
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
