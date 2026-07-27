import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Zakai Mandate — Institutional integration",
  description:
    "Verify consumer authority offline with Ed25519 JWKS. No outbound payments. Status endpoint for revocation.",
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
        For banks · insurers · utilities · municipalities
      </p>
      <h1 className="font-display text-[32px] mb-3">Zakai Mandate</h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-8 max-w-[620px]">
        A signed statement that a named person authorised an agent to do specific
        things on their behalf — verifiable offline against a public key, without
        calling Zakai on every request, and without any ability to move money out
        of the principal&apos;s accounts.
      </p>

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
          why a regulated institution can accept these at scale: the worst case of a
          compromised Mandate is unwanted correspondence, not an emptied account.
        </p>
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
          <li>Verify the compact JWS (EdDSA / Ed25519, typ = zakai-mandate+jws)</li>
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

      <Section heading="Pilot contact">
        <p className="text-[14.5px] leading-relaxed">
          For a technical pilot (read-only verification of sample Mandates against your
          institution id), contact the team via the security channel on the trust page.
          No production dependency on Zakai availability is required for signature checks.
        </p>
        <a
          href={`/${locale}/trust`}
          className="inline-block mt-3 text-emerald font-bold no-underline"
        >
          Trust &amp; security →
        </a>
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
