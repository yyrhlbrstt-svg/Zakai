import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { EmeraldInfoPanel } from "@/components/EmeraldInfoPanel";
import { Link } from "@/i18n/routing";
import { Card } from "@/components/ui";
import { BusinessLeadForm } from "@/components/BusinessLeadForm";
import { DelegationApplyForm } from "@/components/DelegationApplyForm";
import { InstitutionRoiCalculator } from "@/components/InstitutionRoiCalculator";
import { InstitutionBankFitPanel } from "@/components/InstitutionBankFitPanel";
import { InstitutionInboundPressurePanel } from "@/components/InstitutionInboundPressurePanel";
import { INSTITUTION_FIT_HYPOTHESES } from "@/lib/institutionBankFit";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "institutions" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/institutions") },
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
  const fitRows = INSTITUTION_FIT_HYPOTHESES.map((row) => ({
    id: row.id,
    name: he ? row.nameHe : row.nameEn,
    why: he ? row.whyHe : row.whyEn,
    tier: row.tier,
  }));

  return (
    <VerticalPageShell
      heroGlow
      dir={he ? "rtl" : "ltr"}
      kicker={t("heroKicker")}
      title={t("heroTitle")}
      sub={t("heroSub")}
    >
      <EmeraldInfoPanel className="mb-6">
        <strong className="text-emerald">{t("whyAdoptStrong")}</strong> {t("whyAdoptBody")}
      </EmeraldInfoPanel>

      <p className="text-[13px] text-ink-soft mb-6">
        Building an AI agent rather than receiving mandates on behalf of an
        institution? See{" "}
        <Link href="/agents" className="underline text-emerald">
          {ORIGIN}/agents
        </Link>{" "}
        instead — same protocol, framed for the issuing side.
      </p>

      <Section heading="Why this exists">
        <p className="text-[14.5px] leading-relaxed mb-3">
          Today, confirming a consumer agent usually means a human reading a scanned
          power of attorney. That does not scale, and it does not compose with software.
        </p>
        <p className="text-[14.5px] leading-relaxed mb-3">
          The Mandate is the same idea made machine-consumable: scoped, audience-bound,
          short-lived, revocable, and cryptographically signed. Your risk team evaluates
          a public key and a closed set of verbs — not a startup&apos;s uptime.
        </p>
        <p className="text-[14.5px] leading-relaxed">
          This is not a hypothetical volume: <Link href="/companies" className="underline text-emerald">
            {ORIGIN}/companies
          </Link>{" "}
          publishes real, documented outcomes per provider as they accumulate. If your
          organisation appears there, the letters behind that number already carry a
          verifiable Mandate — reading each one by hand is the more expensive path, not
          the safer one.
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

      <Section heading="Quick integration">
        <p className="text-[14.5px] leading-relaxed">
          <Link href="/integrations" className="underline text-emerald">
            {ORIGIN}/integrations
          </Link>{" "}
          — step-by-step verify/decide in ~30 minutes (also in{" "}
          <code className="text-[12px]">docs/INSTITUTION_QUICKSTART.md</code>
          ).
        </p>
        <p className="text-[14.5px] leading-relaxed mt-3">
          <Link href="/network-proof" className="underline text-emerald">
            {ORIGIN}/network-proof
          </Link>{" "}
          — live ledger snapshot for inbound risk teams (no sales call).
        </p>
      </Section>

      <Section heading="What you cannot replicate without the network">
        <p className="text-[14.5px] leading-relaxed mb-3">
          Signature verification is free to implement from the spec — and should
          be. What requires Zakai (or a future admitted issuer you trust through
          the same registry) is the live network layer:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-2 text-[14.5px] leading-relaxed">
          <li>
            <strong>Trust registry</strong> — who may issue at all, with which
            scopes:{" "}
            <a className="text-emerald underline" href={`${ORIGIN}/.well-known/zakai-trust-registry.json`}>
              {ORIGIN}/.well-known/zakai-trust-registry.json
            </a>
          </li>
          <li>
            <strong>Revocation status</strong> — per-mandate live check:{" "}
            <code className="text-[12px]">GET /api/mandate/status/&#123;jti&#125;</code>{" "}
            or the signed status list at{" "}
            <code className="text-[12px]">/api/mandate/revocations</code>
          </li>
          <li>
            <strong>Outcome Oracle</strong> — calibrated pay probability from
            de-identified case outcomes:{" "}
            <code className="text-[12px]">POST /api/oracle/predict</code> (API key;
            institutions channel)
          </li>
          <li>
            <strong>Agent platforms</strong> — verification-only MCP server:{" "}
            <code className="text-[12px]">zakai-mandate-mcp</code> (see{" "}
            <code className="text-[12px]">discoverability</code> in{" "}
            <a className="text-emerald underline" href={`${ORIGIN}/.well-known/zakai-mandate.json`}>
              zakai-mandate.json
            </a>
            )
          </li>
          <li>
            <strong>Opportunity map</strong> — monetizable consumer verticals
            (machine-readable):{" "}
            <a className="text-emerald underline" href={`${ORIGIN}/api/network/opportunity-map`}>
              {ORIGIN}/api/network/opportunity-map
            </a>
          </li>
          <li>
            <strong>Integration quickstart</strong> — step-by-step verify/decide/revoke
            in ~30 minutes: see{" "}
            <code className="text-[12px]">docs/INSTITUTION_QUICKSTART.md</code> in the
            repository (same steps as this page&apos;s endpoints).
          </li>
        </ul>
      </Section>

      <Section heading="What this is worth to your team, in your own numbers">
        <p className="text-[14.5px] leading-relaxed mb-4">
          Not an industry benchmark — three inputs your own ops team already
          has, computed live:
        </p>
        <InstitutionRoiCalculator />
      </Section>

      <Section heading="Hard constraint (the adoption feature)">
        <p className="text-[14.5px] leading-relaxed mb-3">
          A Mandate <strong>cannot</strong> initiate outbound payments, transfers, loans,
          or account closure. Those scopes are forbidden in code, not merely omitted.
        </p>
        <p className="text-[14.5px] leading-relaxed">
          Money only flows <em>toward</em> the consumer (refunds, settlements). That is
          why a regulated institution can accept these at scale.
        </p>
      </Section>

      <Section heading="The short integration: one call, no authorization logic">
        <p className="text-[14.5px] leading-relaxed mb-4">
          Verifying a token tells you it is authentic and leaves you the real
          question: may this agent do <em>this</em> act, right now? That is roughly
          fifty lines every integrator writes, writes differently, and gets one of
          wrong — usually the line where holding &ldquo;may cancel my
          subscriptions&rdquo; is mistaken for agreement to cancel this one.
        </p>
        <pre className="text-[12.5px] leading-relaxed overflow-x-auto bg-black/30 p-4 rounded-lg">
          {`POST /api/mandate/decide
Content-Type: application/json

{
  "token": "<jwt>",
  "audience": "<your-institution-id>",
  "action": "dispute:charge",
  "actConfirmation": "<your-reference>"
}

→ { "decision": "permit" | "deny",
    "reason": "<closed set>",
    "obligations": ["record:<jti>", "notify_principal:<action>"],
    "permitted": ["read:accounts", "dispute:charge"] }`}
        </pre>
        <ul className="list-disc pl-5 flex flex-col gap-2 text-[14.5px] leading-relaxed mt-4">
          <li>
            A deny returns <strong>200</strong>, not 4xx. A refusal is a successful
            answer to a legitimate question, and conflating it with a network error
            is how integrations end up failing open.
          </li>
          <li>
            Deny by default. No path returns permit on error, and an unknown
            revocation status is a deny rather than a permit with a warning.
          </li>
          <li>
            <code className="text-[13px]">reason</code> is a closed set, so you can
            branch on it without it breaking when we reword something.
          </li>
          <li>
            Prefer to hold no dependency on us? Everything above is derivable
            offline from the JWS, the JWKS and the signed status list. The endpoint
            is a convenience, never a requirement.
          </li>
        </ul>
      </Section>

      <Section heading="Prove your implementation is correct, without asking us">
        <p className="text-[14.5px] leading-relaxed mb-4">
          A specification tells you what to do. It does not tell you whether you
          did it. Prose is ambiguous in exactly the places that matter — is the
          audience compared before or after expiry, is a missing claim a refusal
          or a pass, does an unestablished revocation status mean yes — and every
          implementer resolves those differently, silently.
        </p>
        <pre className="text-[12.5px] leading-relaxed overflow-x-auto bg-black/30 p-4 rounded-lg">
          {`GET ${ORIGIN}/api/mandate/test-vectors`}
        </pre>
        <p className="text-[14.5px] leading-relaxed mt-4">
          Deterministic fixtures — fixed key, fixed timestamps, fixed identifiers
          — covering every decision outcome, plus the orderings where two rules
          could both fire. Run them in your own language against your own code.
          There is no partial credit: one wrong answer in a trust network is one
          participant honouring something nobody else does.
        </p>
        <p className="text-[13.5px] text-ink-soft leading-relaxed mt-3">
          The signing key in that document is published on purpose, exactly as
          RFC test vectors publish theirs, so you can regenerate the fixtures
          rather than take our word for them. Its issuer sits under{" "}
          <code className="text-[13px]">.invalid</code> and has no trust-registry
          entry, so no conforming verifier will ever accept a mandate signed
          with it.
        </p>
        <p className="text-[14.5px] leading-relaxed mt-4">
          The rules are also implemented five times over — Python, Go, Java,
          Ruby and PHP — each a single file with{" "}
          <strong>no dependencies at all</strong>, and all five agree on all
          nineteen vectors. The decision layer performs no cryptography, so each
          is something you can read in ten minutes and run with a runtime you
          already have: paste a file rather than clear a package through review.
        </p>
        <p className="text-[13.5px] text-ink-soft leading-relaxed mt-3">
          A specification only its author has implemented is an API with
          documentation. Writing the second one found two ambiguities in the
          first, and writing the vectors found a real bug in ours — it reported{" "}
          <code className="text-[13px]">expired</code> for a token that also
          carried a forbidden scope, hiding a registry-level incident behind a
          stale credential.
        </p>
      </Section>

      <Section heading="Settlement: who is right when you disagree later">
        <p className="text-[14.5px] leading-relaxed mb-4">
          Authorization says who may act. It does not settle what happened. When an
          agent says it was told to act, you say nothing arrived, and the customer
          says they never agreed — today that is resolved by someone reading logs
          owned by one of the disputants.
        </p>
        <p className="text-[14.5px] leading-relaxed mb-4">
          So each act produces a chain of three signed statements: the mandate, your
          decision, and the outcome. Each link carries a hash of the one before it,
          each is signed by the party making that claim, and no central party —
          including us — can fabricate one. Adjudication is a pure function of the
          records, so the same chain yields the same verdict for you, for the
          consumer, for a regulator, and for a court, months later.
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-2 text-[14.5px] leading-relaxed">
          <li>
            Receipts are ordinary JWTs (<code className="text-[13px]">zks</code>{" "}
            claim). Same keys and libraries as the mandate — nothing new to adopt.
          </li>
          <li>
            Verdicts are a closed set, and{" "}
            <code className="text-[13px]">indeterminate</code> is one of them: a
            procedure that always produces a winner will sometimes invent one.
          </li>
          <li>
            A recorded refusal is never treated as fault. Punishing the participants
            who behave correctly is how a network loses them.
          </li>
          <li>
            It settles whether an act was authorised and matched. It does not opine
            on whether the underlying claim was any good — that is a question about
            the world, and answering it would be making things up.
          </li>
        </ul>
      </Section>

      <Section heading="Mandates you did not expect to see: delegated issuance">
        <p className="text-[14.5px] leading-relaxed mb-4">
          Not every mandate presented to you was requested by a person who signed
          up on this site. A third-party agent that would rather not run its own
          Ed25519 keys can have Zakai sign on its behalf, for its own users, whom
          Zakai has never met.
        </p>
        <p className="text-[14.5px] leading-relaxed mb-4">
          That distinction is not hidden in prose you would have to read — it is a
          field on the verified claims:
        </p>
        <pre className="text-[12.5px] leading-relaxed overflow-x-auto bg-black/30 p-4 rounded-lg">
          {`"zkm": {
  "principal": { ... },
  "onBehalfOf": {
    "agent": "some-agent.example",
    "name": "Some Agent",
    "note": "Issued by Zakai on behalf of the named agent.
              The principal's identity was verified by
              that agent, not by Zakai."
  }
}`}
        </pre>
        <ul className="list-disc pl-5 flex flex-col gap-2 text-[14.5px] leading-relaxed mt-4">
          <li>
            Absent means first-party: Zakai verified the principal itself, same as
            any mandate on this page so far.
          </li>
          <li>
            Present means the identity check behind it was performed by the named
            agent, not by Zakai — a narrower assurance, and one you may reasonably
            choose to price, log or gate differently.
          </li>
          <li>
            The delegated issuer never appears in the trust registry: it holds no
            key and signs nothing, so it has no <code className="text-[13px]">iss</code>{" "}
            of its own. <code className="text-[13px]">iss</code> on these mandates
            is still Zakai&apos;s — check{" "}
            <code className="text-[13px]">zkm.onBehalfOf</code>, not the issuer
            list, to find them.
          </li>
          <li>
            Every categorical limit still applies: a delegated issuer cannot obtain
            a scope forbidden to anyone, and can never exceed the specific subset
            it was admitted for — enforced in code, not by agreement.
          </li>
        </ul>
      </Section>

      <Section heading="Building a competing agent? Become a delegated issuer">
        <p className="text-[14.5px] leading-relaxed mb-5">
          If you run a consumer agent and would rather not stand up your own
          Ed25519 key infrastructure, apply here directly. No call, no email
          thread — fill this in and a human reviews it. Admission to a trust
          boundary is never fully automatic, but finding the human to ask
          shouldn&apos;t be your problem.
        </p>
        <DelegationApplyForm />
      </Section>

      <Section id="registered-issuer" heading="Run your own keys instead? Become a registered issuer">
        <p className="text-[14.5px] leading-relaxed mb-4">
          Delegated issuance above is for an agent that would rather not run
          Ed25519 infrastructure of its own. If you already sign your own
          mandates and want an <code className="text-[13px]">iss</code> of your
          own inside the trust registry — the actual Visa-not-issuing-cards
          shape of this network — that is a different, harder admission, and it
          does not start with a form:
        </p>
        <ol className="list-decimal pl-5 flex flex-col gap-2 text-[14.5px] leading-relaxed mb-4">
          <li>
            Read and implement against{" "}
            <code className="text-[13px]">{ORIGIN}/.well-known/zakai-conformance.json</code>{" "}
            — the admission test, published, deliberately hostile: it checks that
            your implementation refuses a forged signature, enforces audience and
            expiry, and will never issue a scope in <code className="text-[13px]">forbidden_scopes</code>.
          </li>
          <li>Run it against your own endpoints. Nobody at Zakai reads your source.</li>
          <li>
            Check yourself first, before a human does:{" "}
            <code className="text-[13px]">POST {ORIGIN}/api/mandate/conformance/probe</code>{" "}
            takes your public JWKS plus a sample mandate you issued and runs the
            reference verifier here against them independently — 7 of the 10
            checks settled without anyone reading a self-report, including
            yours. It cannot check status-list freshness or revocation
            propagation from a single call; those two, plus expiry if you did
            not send an expired sample, come back listed under{" "}
            <code className="text-[13px]">report.missing</code> rather than
            silently assumed to pass.
          </li>
          <li>
            Bring the result through the same technical-pilot form below (select{" "}
            <strong>Mandate / institutional API</strong>) — admission to a trust
            boundary is never fully automatic, but finding the human to ask
            shouldn&apos;t be your problem either.
          </li>
        </ol>
      </Section>

      <Section heading="Versioning: what we will and will not change under you">
        <p className="text-[14.5px] leading-relaxed mb-4">
          The question that actually decides whether an integration is worth
          building isn&apos;t whether the format works today — it&apos;s whether
          it will still mean the same thing in a year. So it&apos;s a written
          commitment, not a hope:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-2 text-[14.5px] leading-relaxed">
          <li>
            <strong>v1 is additive-only.</strong> A new optional field can appear
            without a version bump; a verifier that ignores fields it doesn&apos;t
            recognise keeps working exactly as it does today.
          </li>
          <li>
            <strong>No claim is ever repurposed.</strong> A retired field stays
            retired — it is never redefined to mean something else under the
            same name.
          </li>
          <li>
            <strong>Forbidden scopes only grow.</strong> A scope can move from
            permitted to forbidden; the reverse never happens without a major
            version, because that is the direction that could silently widen
            authority you already granted.
          </li>
          <li>
            A major version carries a minimum <strong>180-day</strong> overlap
            window before the prior version stops verifying.
          </li>
        </ul>
      </Section>

      <Section heading="Integration in six steps">
        <ol className="list-decimal pl-5 flex flex-col gap-2 text-[14.5px] leading-relaxed">
          <li>
            Protocol manifest (start here):{" "}
            <code className="text-[13px]">GET {ORIGIN}/.well-known/zakai-protocol.json</code>
          </li>
          <li>
            Discover endpoints:{" "}
            <code className="text-[13px]">GET {ORIGIN}/.well-known/zakai-mandate.json</code>
          </li>
          <li>
            Cache public keys:{" "}
            <code className="text-[13px]">GET {ORIGIN}/.well-known/zakai-jwks.json</code>
          </li>
          <li>Verify the JWT with your existing library (EdDSA / Ed25519, typ = JWT)</li>
          <li>Reject if <code className="text-[13px]">aud</code> is not your institution id</li>
          <li>Reject if <code className="text-[13px]">exp</code> is past (allow small clock skew)</li>
          <li>
            Recency check:{" "}
            <code className="text-[13px]">GET /api/mandate/status/&#123;jti&#125;</code> → only{" "}
            <code className="text-[13px]">active</code>
          </li>
        </ol>
      </Section>

      <Section heading="Endpoints">
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
          <li>{ORIGIN}/{locale}/registry (human-readable)</li>
          <li>{ORIGIN}/.well-known/zakai-conformance.json</li>
          <li>POST {ORIGIN}/api/mandate/conformance/probe</li>
          <li>{ORIGIN}/api/mandate/revocations</li>
          <li>{ORIGIN}/api/mandate/openapi.json</li>
          <li>{ORIGIN}/api/mandate/scopes</li>
        </ul>
      </Section>

      <Section heading="Reference verify call">
        <pre className="text-[12.5px] leading-relaxed overflow-x-auto bg-black/30 p-4 rounded-lg">
          {`POST /api/mandate/verify
Content-Type: application/json

{
  "token": "<compact-jws>",
  "audience": "<your-institution-id>"
}`}
        </pre>
      </Section>

      <Section heading="Request a technical pilot">
        <p className="text-[14.5px] leading-relaxed mb-5">
          Read-only verification of sample Mandates against your institution id.
          No production dependency on Zakai availability is required for signature checks.
          Select <strong>Mandate / institutional API</strong> (or Both) in the form.
        </p>
        <div dir={locale === "he" || locale === "ar" ? "rtl" : "ltr"}>
          <BusinessLeadForm />
        </div>
        <div className="flex flex-wrap gap-4 mt-6">
          <a href={`/${locale}/trust`} className="text-emerald font-bold no-underline">
            Trust & security →
          </a>
          <a href={`/${locale}/business#infrastructure`} className="text-emerald font-bold no-underline">
            Business page →
          </a>
          <a
            href={`${ORIGIN}/api/mandate/openapi.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-soft font-bold no-underline"
          >
            OpenAPI →
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
