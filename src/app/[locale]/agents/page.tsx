import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "agents" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/agents") },
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

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-4" dir="ltr">
      <p className="text-[12px] uppercase tracking-wide text-emerald font-bold mb-2">
        For builders of AI agents — not only Zakai&apos;s own
      </p>
      <h1 className="font-display text-[32px] mb-3">
        Every agent that acts for a person eventually needs to prove it
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-8 max-w-[620px]">
        Cancel a subscription, dispute a charge, request a record, appeal a
        fine — any agent that does one of these on a person&apos;s behalf will
        eventually be asked, by the counterparty on the other end,{" "}
        <em>who told you that you could do this?</em> Today almost nobody
        outside finance has a real answer, and most of finance&apos;s answer is
        a person reading a scanned form. This is Zakai&apos;s answer, and it is
        not proprietary to Zakai&apos;s own product.
      </p>

      <div className="mb-6 rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] px-4 py-3 text-[13.5px] leading-relaxed">
        <strong className="text-emerald">This page is an invitation, not a claim.</strong>{" "}
        Nothing here says any agent already uses this. It says the protocol,
        the reference verifier, the SDK and an independent conformance check
        are real, running, and yours to build against today — for free, with
        no call to Zakai required at verification time.
      </div>

      <Section heading="Why this isn't a finance feature">
        <p className="text-[14.5px] leading-relaxed mb-3">
          Strip the money vocabulary away and the underlying object is:{" "}
          <em>
            person P authorises agent A to perform act X against institution
            I — verifiably, revocably, within a stated limit, leaving a
            settlement record nobody can unilaterally rewrite.
          </em>{" "}
          Nothing in that sentence is about money. It is about an institution
          accepting an instruction from software acting for a human, which is
          unsolved identically in health, government, employment, housing and
          education.
        </p>
        <p className="text-[14.5px] leading-relaxed mb-3">
          Only finance is live today. The rest are reserved, and their
          categorical limits are already fixed — decided before any
          sector&apos;s first customer could negotiate an exception:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-2 text-[14.5px] leading-relaxed">
          <li><strong>Finance (live):</strong> an agent may never move money outward.</li>
          <li><strong>Health (reserved):</strong> may never consent to treatment, refuse care, or alter a clinical record — only request, correct and dispute.</li>
          <li><strong>Government (reserved):</strong> may never waive a right, enter a plea, or surrender a status.</li>
          <li><strong>Employment (reserved):</strong> may never resign on someone&apos;s behalf or sign a binding term.</li>
          <li><strong>Housing (reserved):</strong> may never sign, surrender or terminate a tenancy.</li>
          <li><strong>Education (reserved):</strong> may never withdraw an enrolment or accept an academic sanction.</li>
        </ul>
        <p className="text-[13px] leading-relaxed mt-3 text-ink-soft">
          Full spec: <code className="text-[12.5px]">{ORIGIN}/.well-known/zakai-mandate.json</code>{" "}
          (see the <code className="text-[12.5px]">domains</code> field).
        </p>
      </Section>

      <Section heading="What your agent actually gets">
        <ol className="list-decimal pl-5 flex flex-col gap-3 text-[14.5px] leading-relaxed">
          <li>
            <strong>Issue</strong> a signed mandate for a person who told your
            agent to act — a plain JWT (EdDSA / Ed25519), verifiable by any
            JWT library that already exists in your stack.
          </li>
          <li>
            <strong>Present</strong> it to the counterparty. They verify it
            offline against a published JWKS — no live call to Zakai, no
            uptime dependency on a startup they&apos;ve never heard of.
          </li>
          <li>
            <strong>Settle</strong> — when the counterparty later disputes
            what happened, a signed hash chain of mandate → decision →
            outcome produces a verdict from the records alone, with no human
            reading a log to decide who was right.
          </li>
        </ol>
      </Section>

      <Section heading="Try it now">
        <p className="text-[14.5px] leading-relaxed mb-3">
          Three lines, in any language with a JWT library:
        </p>
        <pre className="bg-[#0d1117] text-[#e6edf3] text-[12.5px] leading-relaxed rounded-lg p-4 overflow-x-auto mb-4">
{`import { verifyMandateFromUrl } from "@zakai/mandate-sdk";

const claims = await verifyMandateFromUrl(token, {
  audience: "your-agent-or-institution-id",
  jwksUri: "${ORIGIN}/.well-known/zakai-jwks.json",
});`}
        </pre>
        <p className="text-[14.5px] leading-relaxed">
          The SDK is ported line-for-line from this production app, not
          reimplemented against a spec describing it — the SDK and the
          servers it talks to cannot silently disagree about what a mandate
          means. Not published to npm yet; source lives in this repository
          under <code className="text-[12.5px]">sdk/</code>.
        </p>
      </Section>

      <Section heading="Prove your own implementation, without anyone reading your code">
        <p className="text-[14.5px] leading-relaxed mb-3">
          If your agent issues mandates with its own keys rather than
          Zakai&apos;s, an independent check exists so nobody has to take your
          word for it:
        </p>
        <pre className="bg-[#0d1117] text-[#e6edf3] text-[12.5px] leading-relaxed rounded-lg p-4 overflow-x-auto">
{`POST ${ORIGIN}/api/mandate/conformance/probe
{
  "jwks": [ /* your public JWKS keys */ ],
  "audience": "the audience your sample token was issued for",
  "sampleValidToken": "..."
}`}
        </pre>
        <p className="text-[13px] leading-relaxed mt-3 text-ink-soft">
          Runs the reference verifier here against your own artifacts as a
          neutral judge — 7 of the 10 published conformance checks settled
          without trusting anything you say about your own code. Full suite:{" "}
          <code className="text-[12.5px]">{ORIGIN}/.well-known/zakai-conformance.json</code>.
        </p>
      </Section>

      <Section heading="Nobody needs our permission">
        <p className="text-[14.5px] leading-relaxed">
          The specification is freely implementable by anyone, in any
          language, without royalty or a licensing conversation — Zakai will
          not assert a claim against a good-faith independent implementation
          of it. The reference implementations (this app&apos;s own verifier,
          the SDK) are MIT-licensed. &quot;Zakai Mandate&quot; names the
          specification profile; your own implementation of it can be called
          whatever you like. A protocol whose owner can decide later that you
          owe it something is not one worth building a dependency on, and
          this one is written so that objection has a real answer, not a
          reassuring sentence.
        </p>
      </Section>

      <Section heading="What this will never do">
        <ul className="list-disc pl-5 flex flex-col gap-2 text-[14.5px] leading-relaxed">
          <li>
            Let a forbidden scope through, in any domain — enforced in code,
            not by agreement, and enforced globally so a mandate cannot reach
            a forbidden act by declaring itself to be in a different sector.
          </li>
          <li>
            Require a live call to Zakai to verify a mandate. Verification is
            entirely offline once you hold the JWKS.
          </li>
          <li>
            Ask for biometric or universal identity. A mandate proves a
            specific, scoped, revocable authorisation — never who someone is
            in general.
          </li>
        </ul>
      </Section>

      <Section heading="Read more">
        <div className="flex flex-wrap gap-4">
          <a href={`/${locale}/institutions`} className="text-emerald font-bold no-underline">
            Institutional integration guide →
          </a>
          <a href={`${ORIGIN}/.well-known/zakai-mandate.json`} target="_blank" rel="noopener noreferrer" className="text-ink-soft font-bold no-underline">
            Discovery document →
          </a>
          <a href={`${ORIGIN}/api/mandate/openapi.json`} target="_blank" rel="noopener noreferrer" className="text-ink-soft font-bold no-underline">
            OpenAPI →
          </a>
        </div>
      </Section>
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
