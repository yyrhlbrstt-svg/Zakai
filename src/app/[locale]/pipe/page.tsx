import type { Metadata } from "next";
import type { ReactNode } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { EmeraldInfoPanel } from "@/components/EmeraldInfoPanel";
import { Card, Button } from "@/components/ui";
import { Link } from "@/i18n/routing";
import { alternateLanguages, defaultOpenGraph, SITE_URL } from "@/lib/seo";
import { textDirection } from "@/lib/textDirection";
import { buildZakaiPipeDocument } from "@/lib/pipe/zakaiPipe";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pipe" });
  const title = t("metaTitle");
  const description = t("metaDesc");
  return {
    title,
    description,
    alternates: { languages: alternateLanguages("/pipe") },
    openGraph: defaultOpenGraph(locale, { title, description, path: "/pipe" }),
  };
}

export default async function PipePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pipe" });
  const dir = textDirection(locale);
  const origin = SITE_URL || "https://zakai-3uxj.vercel.app";
  const pipe = buildZakaiPipeDocument(origin);

  return (
    <VerticalPageShell
      heroGlow
      dir={dir}
      kicker={t("kicker")}
      title={t("title")}
      sub={t("sub")}
    >
      <EmeraldInfoPanel className="mb-6">
        <strong className="text-emerald">{t("thesisStrong")}</strong> {t("thesisBody")}
      </EmeraldInfoPanel>

      <div className="flex flex-wrap gap-3 mb-8">
        <a href={`${origin}/.well-known/zakai-pipe.json`} className="no-underline">
          <Button>{t("ctaManifest")}</Button>
        </a>
        <a href={`${origin}/api/pipe`} className="no-underline">
          <Button variant="ghost">{t("ctaLive")}</Button>
        </a>
        <a href={`${origin}/api/pipe/mark`} className="no-underline">
          <Button variant="ghost">{t("ctaMark")}</Button>
        </a>
        <Link href="/money" className="no-underline">
          <Button variant="ghost">{t("ctaConsumer")}</Button>
        </Link>
      </div>

      <Section heading={t("railsHeading")}>
        <Rail
          title={t("railAuthority")}
          body={t("railAuthorityBody")}
          links={[
            { href: pipe.rails.authority.accept, label: "POST /api/pipe/accept" },
            { href: pipe.rails.authority.jwks, label: "JWKS" },
            { href: pipe.rails.authority.decide, label: "decide" },
          ]}
        />
        <Rail
          title={t("railIntake")}
          body={t("railIntakeBody")}
          links={[
            { href: pipe.rails.intake.reference_post, label: "inbound-receive" },
            { href: pipe.rails.intake.spec, label: "spec" },
            { href: pipe.rails.intake.clone, label: "clone receiver" },
          ]}
        />
        <Rail
          title={t("railOutcomes")}
          body={t("railOutcomesBody")}
          links={[
            { href: pipe.rails.outcomes.savings_ledger, label: "savings-ledger" },
            { href: "/proofs", label: t("proofsWall"), internal: true },
          ]}
        />
        <Rail
          title={t("railAgents")}
          body={t("railAgentsBody")}
          links={[
            { href: pipe.rails.agents.handoff, label: "POST /api/pipe/handoff" },
            { href: pipe.rails.agents.economy, label: "agent-economy" },
            { href: "/agents", label: t("agentsPage"), internal: true },
          ]}
        />
      </Section>

      <Card className="p-6 mb-4 border-emerald/30">
        <h2 className="font-display text-xl mb-2">{t("minutesHeading")}</h2>
        <p className="text-[14px] text-ink-soft leading-relaxed mb-3">{t("minutesBody")}</p>
        <pre className="text-[12.5px] leading-relaxed overflow-x-auto bg-black/30 p-4 rounded-lg" dir="ltr">
{`curl -sS -X POST ${origin}/api/pipe/accept \\
  -H 'content-type: application/json' \\
  -d '{"mandate_jws":"<JWS>","action":"correspond:provider"}'`}
        </pre>
        <pre className="text-[12.5px] leading-relaxed overflow-x-auto bg-black/30 p-4 rounded-lg mt-3" dir="ltr">
{`curl -sS -X POST ${origin}/api/pipe/handoff \\
  -H 'content-type: application/json' \\
  -d '{"agent":"my-ai","door":"cancel","locale":"he"}'`}
        </pre>
      </Card>

      <p className="text-[13px] text-ink-soft">
        {t("related")}{" "}
        <Link href="/institutions" className="text-emerald underline">
          /institutions
        </Link>{" "}
        ·{" "}
        <Link href="/standard" className="text-emerald underline">
          /standard
        </Link>{" "}
        ·{" "}
        <Link href="/integrations" className="text-emerald underline">
          /integrations
        </Link>
      </p>
    </VerticalPageShell>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl mb-4">{heading}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Rail({
  title,
  body,
  links,
}: {
  title: string;
  body: string;
  links: Array<{ href: string; label: string; internal?: boolean }>;
}) {
  return (
    <Card className="p-5">
      <h3 className="font-extrabold text-[15px] m-0 mb-1">{title}</h3>
      <p className="text-[13.5px] text-ink-soft leading-relaxed m-0 mb-3">{body}</p>
      <div className="flex flex-wrap gap-3 text-[12.5px] font-mono">
        {links.map((l) =>
          l.internal ? (
            <Link key={l.label} href={l.href} className="text-emerald font-bold no-underline">
              {l.label} →
            </Link>
          ) : (
            <a
              key={l.label}
              href={l.href}
              className="text-emerald font-bold no-underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {l.label} →
            </a>
          ),
        )}
      </div>
    </Card>
  );
}
