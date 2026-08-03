import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { EmeraldInfoPanel } from "@/components/EmeraldInfoPanel";
import { Link } from "@/i18n/routing";
import { Card, Button } from "@/components/ui";
import { BusinessLeadForm } from "@/components/BusinessLeadForm";
import { DelegationApplyForm } from "@/components/DelegationApplyForm";
import { InstitutionRoiCalculator } from "@/components/InstitutionRoiCalculator";
import { InstitutionBankFitPanel } from "@/components/InstitutionBankFitPanel";
import { InstitutionInboundPressurePanel } from "@/components/InstitutionInboundPressurePanel";
import { ControlGatesStrip } from "@/components/ControlGatesStrip";
import { LiveGravityStrip } from "@/components/LiveGravityStrip";
import { institutionPilotMailto, institutionSalesEmail } from "@/lib/institutionPull";
import { RegulatoryIntelStrip } from "@/components/RegulatoryIntelStrip";
import { INSTITUTION_FIT_HYPOTHESES } from "@/lib/institutionBankFit";
import { institutionsLongCopy } from "@/lib/marketing/institutionsLongCopy";
import { textDirection } from "@/lib/textDirection";
import { alternateLanguages, defaultOpenGraph } from "@/lib/seo";
import { provenSavings } from "@/lib/services/selfReportedSaving";
import { prisma } from "@/lib/prisma";
import { bcp47, type Locale } from "@/i18n/config";
import { heEn } from "@/lib/heEn";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "institutions" });
  const title = t("metaTitle");
  const description = t("metaDesc");
  return {
    title,
    description,
    alternates: { languages: alternateLanguages("/institutions") },
    openGraph: defaultOpenGraph(locale, { title, description, path: "/institutions" }),
  };
}

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

export default async function InstitutionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "institutions" });
  const he = locale === "he" || locale === "ar";
  const dir = textDirection(locale);
  const fitRows = INSTITUTION_FIT_HYPOTHESES.map((row) => ({
    id: row.id,
    name: he ? row.nameHe : row.nameEn,
    why: he ? row.whyHe : row.whyEn,
    tier: row.tier,
  }));
  const longCopy = institutionsLongCopy(locale, ORIGIN);
  const tHome = await getTranslations({ locale });
  const [proof, sentCount, mandateCount] = await Promise.all([
    provenSavings(),
    prisma.case.count({ where: { status: { in: ["SENT", "SAVED"] } } }).catch(() => 0),
    prisma.authorization
      .count({ where: { status: "ACTIVE", revokedAt: null } })
      .catch(() => 0),
  ]);

  return (
    <VerticalPageShell
      heroGlow
      dir={dir}
      kicker={t("heroKicker")}
      title={t("heroTitle")}
      sub={t("heroSub")}
    >
      <EmeraldInfoPanel className="mb-6">
        <strong className="text-emerald">{t("whyAdoptStrong")}</strong> {t("whyAdoptBody")}
      </EmeraldInfoPanel>

      <div className="mb-6">
        <LiveGravityStrip
          localeBcp47={bcp47[locale as Locale]}
          verifiedMinor={proof.verifiedMinor}
          verifiedCount={proof.verifiedCount}
          sentCount={sentCount}
          mandateCount={mandateCount}
          labels={{
            title: he
              ? "כבידה אמיתית — מה שמוסד רואה לפני אימוץ"
              : "Real gravity — what an institution sees before adopting",
            sent: tHome("home.gravitySent"),
            mandates: tHome("home.gravityMandates"),
            proofs: tHome("home.gravityProofs"),
            empty: tHome("home.gravityEmpty"),
            ledger: tHome("home.gravityLedger"),
          }}
        />
      </div>

      <Card className="mb-8 p-5 border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.07)]">
        <div className="font-extrabold text-[16px] text-emerald mb-2">
          {heEn(he, "מסלול אימוץ אחד — 20–30 דקות", "One adoption path — 20–30 minutes")}
        </div>
        <p className="text-[13.5px] text-ink-soft leading-relaxed mb-3">
          {he
            ? "Node או Python → READY_FOR_PIONEER → תביעת Pioneer באשף. אותו שער מכונה. בלי שיחת מכירות."
            : "Node or Python → READY_FOR_PIONEER → claim Pioneer in the wizard. Same machine gate. No sales call."}
        </p>
        <pre
          className="rounded-xl bg-[#060b12] border border-[rgba(255,255,255,0.1)] px-4 py-3 text-[12.5px] font-mono text-ink overflow-x-auto mb-3"
          dir="ltr"
        >{`# Node
cd sdk && npm ci && npm run ready

# Python
cd sdk/python && pip install -e '.[crypto]' && zakai-mandate-ready`}</pre>
        <p className="text-[12.5px] text-ink-soft leading-relaxed mb-3">
          {heEn(
            he,
            "אימות בלבד · inbound-only · scopes של כסף יוצא אסורים תמיד. ראו SAFETY.md.",
            "Verify-only · inbound-only · outbound money scopes always forbidden. See SAFETY.md.",
          )}
        </p>
        <ol className="m-0 ps-5 flex flex-col gap-1.5 text-[13.5px] text-ink-soft leading-relaxed mb-4">
          <li>
            <span className="font-mono">npm run ready</span>
            {heEn(he, " / ", " / ")}
            <span className="font-mono">zakai-mandate-ready</span>
            {heEn(he, " → READY_FOR_PIONEER", " → READY_FOR_PIONEER")}
          </li>
          <li>
            GET{" "}
            <a className="text-emerald font-mono break-all" href={`${ORIGIN}/api/mandate/ready`}>
              /api/mandate/ready
            </a>
          </li>
          <li>
            {heEn(
              he,
              "אשף Reference Verifier → מקום Pioneer (עד 3)",
              "Reference Verifier wizard → Pioneer slot (max 3)",
            )}
          </li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Link href="/institutions/quickstart" className="no-underline">
            <Button className="!text-[13px]">{heEn(he, "Quickstart מלא", "Full quickstart")}</Button>
          </Link>
          <Link href="/institutions/leader" className="no-underline">
            <Button variant="ghost" className="!text-[13px]">
              {heEn(he, "תביעת Pioneer", "Claim Pioneer")}
            </Button>
          </Link>
          <a
            href="https://github.com/yyrhlbrstt-svg/Zakai/blob/main/sdk/QUICKSTART.md"
            className="no-underline"
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="ghost" className="!text-[13px]">
              sdk/QUICKSTART.md
            </Button>
          </a>
        </div>
      </Card>

      <details className="mb-8 text-[13px] text-ink-soft">
        <summary className="cursor-pointer font-bold select-none text-ink">
          {heEn(he, "חלופות (לא הדלת הראשית)", "Alternatives (not the main door)")}
        </summary>
        <div className="flex flex-wrap gap-3 mt-3">
          <Link href="/pipe" className="no-underline">
            <Button variant="ghost" className="!text-[13px]">
              {heEn(he, "הצינור — Mandate → SavingsProof", "The Pipe — Mandate → SavingsProof")}
            </Button>
          </Link>
          <a href={institutionPilotMailto()} className="no-underline">
            <Button variant="ghost" className="!text-[13px]">{t("heroMailtoCta")}</Button>
          </a>
          <a
            href={`mailto:${institutionSalesEmail()}`}
            className="text-[13px] text-ink-soft self-center font-mono"
            dir="ltr"
          >
            {institutionSalesEmail()}
          </a>
        </div>
      </details>

      <RegulatoryIntelStrip
        title={t("regulatoryStripTitle")}
        body={t("regulatoryStripBody")}
        snapshotCta={t("regulatoryStripSnapshot")}
        pressureCta={t("regulatoryStripPressure")}
        networkCta={t("regulatoryStripNetwork")}
        kitCta={t("regulatoryStripKit")}
      />

      <ControlGatesStrip locale={locale} />

      <p className="text-[13px] text-ink-soft mb-6">
        {t("agentsCrossLink")}{" "}
        <Link href="/agents" className="underline text-emerald">
          /agents
        </Link>{" "}
        {t("agentsCrossLinkSuffix")}
      </p>

      <Section heading={t("whyExistsHeading")}>
        <p className="text-[14.5px] leading-relaxed mb-3">{t("whyExists1")}</p>
        <p className="text-[14.5px] leading-relaxed mb-3">{t("whyExists2")}</p>
        <p className="text-[14.5px] leading-relaxed">
          {t("whyExists3")}{" "}
          <Link href="/companies" className="underline text-emerald">
            /companies
          </Link>{" "}
          {t("whyExists3Link")}
        </p>
      </Section>

      <InstitutionBankFitPanel
        title={t("fitTitle")}
        disclaimer={t("fitDisclaimer")}
        band={t("fitAdoptionBand")}
        tierLabels={{
          high: t("fitTierHigh"),
          medium: t("fitTierMedium"),
          exploratory: t("fitTierExploratory"),
        }}
        rows={fitRows}
      />

      <InstitutionInboundPressurePanel locale={locale} />

      <Card className="p-6 mb-4 border-emerald/30">
        <h2 className="font-display text-xl mb-2">{t("leaderCtaTitle")}</h2>
        <p className="text-[14.5px] leading-relaxed mb-4">{t("leaderCtaBody")}</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/institutions/leader" className="text-emerald font-bold no-underline">
            {t("leaderCtaLink")} →
          </Link>
          <Link href="/institutions/leaders" className="text-ink-soft font-bold no-underline">
            {t("leaderWallLink")} →
          </Link>
        </div>
      </Card>

      <Section heading={t("quickIntegrationHeading")}>
        <p className="text-[14.5px] leading-relaxed">
          <Link href="/integrations" className="underline text-emerald">
            /integrations
          </Link>{" "}
          {t("quickIntegration1")}{" "}
          <code className="text-[12px]">docs/INSTITUTION_QUICKSTART.md</code>
          ).
        </p>
        <p className="text-[14.5px] leading-relaxed mt-3">
          <Link href="/network-proof" className="underline text-emerald">
            /network-proof
          </Link>{" "}
          {t("quickIntegration2")}
        </p>
      </Section>

      {longCopy.sections.map((section) => {
        const sectionId = section.id === "registeredIssuer" ? "registered-issuer" : undefined;
        const body = (
          <>
            {section.paragraphs?.map((p, i) => (
              <p key={i} className="text-[14.5px] leading-relaxed mb-3 last:mb-0">
                {p}
              </p>
            ))}
            {section.pre ? (
              <pre className="text-[12.5px] leading-relaxed overflow-x-auto bg-black/30 p-4 rounded-lg mt-3">
                {section.pre}
              </pre>
            ) : null}
            {section.bullets ? (
              <ul className="list-disc ps-5 flex flex-col gap-2 text-[14.5px] leading-relaxed mt-4">
                {section.bullets.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : null}
            {section.numbered ? (
              <ol className="list-decimal ps-5 flex flex-col gap-2 text-[14.5px] leading-relaxed mt-3 mb-4">
                {section.numbered.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            ) : null}
            {section.tailParagraphs?.map((p, i) => (
              <p key={i} className="text-[14.5px] leading-relaxed mt-4">
                {p}
              </p>
            ))}
            {section.softParagraphs?.map((p, i) => (
              <p key={i} className="text-[13.5px] text-ink-soft leading-relaxed mt-3">
                {p}
              </p>
            ))}
            {section.id === "roi" ? (
              <div className="mt-4">
                <InstitutionRoiCalculator />
              </div>
            ) : null}
            {section.id === "delegatedApply" ? (
              <div className="mt-5">
                <DelegationApplyForm />
              </div>
            ) : null}
          </>
        );
        return (
          <Section key={section.id} id={sectionId} heading={section.heading}>
            {body}
          </Section>
        );
      })}

      <Section heading={longCopy.tail.endpointsHeading}>
        <ul className="flex flex-col gap-2 text-[14px] font-mono break-all">
          <li>{ORIGIN}/.well-known/zakai-protocol.json</li>
          <li>{ORIGIN}/api/network</li>
          <li>{ORIGIN}/.well-known/zakai-mandate.json</li>
          <li>{ORIGIN}/.well-known/zakai-jwks.json</li>
          <li>{ORIGIN}/api/mandate/status/&#123;jti&#125;</li>
          <li>POST {ORIGIN}/api/mandate/verify</li>
          <li>POST {ORIGIN}/api/mandate/decide</li>
          <li>{ORIGIN}/api/mandate/test-vectors</li>
          <li>{ORIGIN}/.well-known/zakai-trust-registry.json</li>
          <li>
            {ORIGIN}/{locale}/registry ({t("registryHumanReadable")})
          </li>
          <li>{ORIGIN}/.well-known/zakai-conformance.json</li>
          <li>POST {ORIGIN}/api/mandate/conformance/probe</li>
          <li>{ORIGIN}/api/mandate/revocations</li>
          <li>{ORIGIN}/api/mandate/openapi.json</li>
          <li>{ORIGIN}/api/mandate/scopes</li>
        </ul>
      </Section>

      <Section heading={longCopy.tail.pilotHeading}>
        <p className="text-[14.5px] leading-relaxed mb-5">{longCopy.tail.pilotBody}</p>
        <div dir={dir}>
          <BusinessLeadForm />
        </div>
        <div className="flex flex-wrap gap-4 mt-6">
          <a href={`/${locale}/trust`} className="text-emerald font-bold no-underline">
            {longCopy.tail.trustLink}
          </a>
          <a href={`/${locale}/business#infrastructure`} className="text-emerald font-bold no-underline">
            {longCopy.tail.businessLink}
          </a>
          <a
            href={`${ORIGIN}/api/mandate/openapi.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-soft font-bold no-underline"
          >
            {longCopy.tail.openapiLink}
          </a>
        </div>
      </Section>
    </VerticalPageShell>
  );
}

function Section({
  heading,
  children,
  id,
}: {
  heading: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <Card id={id} className="p-6 mb-4 scroll-mt-24">
      <h2 className="font-display text-xl mb-3">{heading}</h2>
      {children}
    </Card>
  );
}
