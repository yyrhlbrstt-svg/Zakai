import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui";
import { BusinessLeadForm } from "@/components/BusinessLeadForm";

export const metadata: Metadata = {
  title: "Zakai Mandate — Institutional integration",
  description:
    "Verify consumer authority offline with Ed25519 JWKS. No outbound payments. Status endpoint for revocation. The emerging standard for consumer agent authority.",
};

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

export default async function InstitutionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-4" dir="ltr">
      <p className="text-[12px] uppercase tracking-wide text-emerald font-bold mb-2">
        For banks · insurers · utilities · municipalities · fintechs
      </p>
      <h1 className="font-display text-[32px] mb-3">Zakai Mandate</h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-8 max-w-[620px]">
        A signed statement that a named person authorised an agent to do specific
        things on their behalf — verifiable offline against a public key, without
        calling Zakai on every request, and without any ability to move money out
        of the principal&apos;s accounts.
      </p>

      <div className="mb-6 rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] px-4 py-3 text-[13.5px] leading-relaxed">
        <strong className="text-emerald">Why institutions adopt this:</strong> the worst
        case of a compromised Mandate is unwanted correspondence, not an emptied
        account. Forbidden payment scopes are enforced in code.
      </div>

      <Section heading="Why this exists">
        <p className="text-[14.5px] leading-relaxed mb-3">
          Today, confirming a consumer agent usually means a human reading a scanned
          power of attorney. That does not scale, and it does not compose with software.
        </p>
        <p className="text-[14.5px] leading-relaxed">
          The Mandate is the same idea made machine-consumable: scoped, audience-bound,
          short-lived, revocable, and cryptographically signed. Your risk team evaluates
          a public key and a closed set of verbs — not a startup&apos;s uptime.
        </p>
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
          There is a second implementation, in Python, with{" "}
          <strong>no dependencies at all</strong> — the decision layer performs
          no cryptography, so it is one file you can read in ten minutes and run
          with the interpreter you already have. A specification only its author
          has implemented is an API with documentation; this one has been
          written twice, and writing it the second time is what found two
          ambiguities in the first.
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

      <Section heading="Integration in six steps">
        <ol className="list-decimal pl-5 flex flex-col gap-2 text-[14.5px] leading-relaxed">
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
          <li>{ORIGIN}/.well-known/zakai-mandate.json</li>
          <li>{ORIGIN}/.well-known/zakai-jwks.json</li>
          <li>{ORIGIN}/api/mandate/status/&#123;jti&#125;</li>
          <li>POST {ORIGIN}/api/mandate/verify</li>
          <li>POST {ORIGIN}/api/mandate/decide</li>
          <li>{ORIGIN}/api/mandate/test-vectors</li>
          <li>{ORIGIN}/.well-known/zakai-trust-registry.json</li>
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
