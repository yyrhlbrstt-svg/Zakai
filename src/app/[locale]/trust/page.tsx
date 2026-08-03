import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { FEE_DISPUTE_WINDOW_DAYS } from "@/lib/services/cases";
import { alternateLanguages } from "@/lib/seo";
import { publicSecurityEmail, publicSupportEmail } from "@/lib/contact";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trustPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/trust") },
  };
}

const SECURITY_EMAIL = publicSecurityEmail();
const SUPPORT_EMAIL = publicSupportEmail();
const SITE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

export default async function TrustPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("trustPage");

  const security = t.raw("security") as string[];
  const trust = t.raw("trust") as string[];
  const different = t.raw("different") as string[];
  const jwksUrl = `${SITE_ORIGIN}/.well-known/zakai-jwks.json`;
  const openapiUrl = `${SITE_ORIGIN}/api/mandate/openapi.json`;

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-4">
      <h1 className="font-display text-[32px] mb-3">{t("title")}</h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-8 max-w-[620px]">
        {t("intro")}
      </p>

      <Section heading={t("differentHeading")}>
        <p className="text-[14.5px] leading-relaxed mb-3">{t("differentIntro")}</p>
        <Bullets items={different} />
        <p className="text-[13px] text-ink-soft leading-relaxed mt-4 pt-3 border-t border-[rgba(255,255,255,0.08)]">
          {t("differentProof")}
          <a href={jwksUrl} target="_blank" rel="noopener noreferrer" className="text-emerald font-bold" dir="ltr">
            /.well-known/zakai-jwks.json
          </a>
          {t("differentProofEnd")}
          <a href={openapiUrl} target="_blank" rel="noopener noreferrer" className="text-emerald font-bold" dir="ltr">
            /api/mandate/openapi.json
          </a>
          .
        </p>
      </Section>

      <Section heading={t("securityHeading")}>
        <Bullets items={security} />
      </Section>

      <Section heading={t("trustHeading")}>
        <Bullets items={trust} />
      </Section>

      <Section heading={t("disputeHeading")}>
        <p className="text-[14.5px] leading-relaxed">
          {t("dispute", { days: FEE_DISPUTE_WINDOW_DAYS, email: SUPPORT_EMAIL })}
        </p>
      </Section>

      <Section heading={t("contactHeading")}>
        <p className="text-[14.5px] leading-relaxed">
          {t("contact", { email: SECURITY_EMAIL })}
        </p>
        <a
          href={`mailto:${SECURITY_EMAIL}`}
          className="inline-block mt-2 text-emerald font-bold no-underline"
          dir="ltr"
        >
          {SECURITY_EMAIL}
        </a>
      </Section>

      <Section heading={t("supportHeading")}>
        <p className="text-[14.5px] leading-relaxed">{t("supportContact", { email: SUPPORT_EMAIL })}</p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-block mt-2 text-emerald font-bold no-underline"
          dir="ltr"
        >
          {SUPPORT_EMAIL}
        </a>
      </Section>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] leading-relaxed border-t border-[rgba(255,255,255,0.09)] pt-4">
        {t("disclaimer")}
      </p>
    </main>
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

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
      {items.map((line, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed">
          <span className="text-emerald font-black mt-0.5 shrink-0" aria-hidden>
            ✓
          </span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
