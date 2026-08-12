import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Button, Card } from "@/components/ui";
import { CodeBlock } from "@/components/CodeBlock";
import { EmeraldInfoPanel } from "@/components/EmeraldInfoPanel";
import { alternateLanguages } from "@/lib/seo";
import { heEn } from "@/lib/heEn";

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
const GH_QUICKSTART =
  "https://github.com/yyrhlbrstt-svg/Zakai/blob/main/sdk/QUICKSTART.md";
const GH_SAFETY = "https://github.com/yyrhlbrstt-svg/Zakai/blob/main/sdk/SAFETY.md";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const he = locale === "he" || locale === "ar";
  return {
    title: he ? "Quickstart — Mandate ב־20–30 דקות" : "Quickstart — Mandate in 20–30 minutes",
    description: he
      ? "Node או Python → READY_FOR_PIONEER → תביעת Pioneer. בלי שיחת מכירות. בלי כסף יוצא."
      : "Node or Python → READY_FOR_PIONEER → claim Pioneer. No sales call. No outbound money.",
    alternates: { languages: alternateLanguages("/institutions/quickstart") },
  };
}

export default async function InstitutionQuickstartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";

  return (
    <VerticalPageShell
      heroGlow
      kicker={heEn(he, "מוסדות · מסלול אחד", "Institutions · one path")}
      title={heEn(he, "Mandate ב־20–30 דקות", "Mandate in 20–30 minutes")}
      sub={
        he
          ? "שלושה שלבים: הרצה על המכונה → READY_FOR_PIONEER → תביעת Pioneer. בלי שיחת מכירות. בלי לקוחות מומצאים. הפרוטוקול inbound-only."
          : "Three steps: run on your machine → READY_FOR_PIONEER → claim Pioneer. No sales call. No invented customers. Protocol is inbound-only."
      }
    >
      <ol className="mb-6 grid gap-3 sm:grid-cols-3 list-none p-0 m-0">
        {(
          he
            ? [
                { n: "1", t: "הרצה", s: "~10 דק׳ — Node או Python" },
                { n: "2", t: "READY_FOR_PIONEER", s: "vectors + Status List חתום" },
                { n: "3", t: "Pioneer", s: "אשף Reference Verifier" },
              ]
            : [
                { n: "1", t: "Run", s: "~10 min — Node or Python" },
                { n: "2", t: "READY_FOR_PIONEER", s: "vectors + signed Status List" },
                { n: "3", t: "Pioneer", s: "Reference Verifier wizard" },
              ]
        ).map((step) => (
          <li
            key={step.n}
            className="rounded-xl border border-[rgba(63,203,155,0.28)] bg-[rgba(63,203,155,0.06)] px-4 py-3"
          >
            <div className="text-[11px] font-extrabold text-emerald tracking-wide">{step.n}</div>
            <div className="font-extrabold text-[14.5px] mt-0.5">{step.t}</div>
            <div className="text-[12.5px] text-ink-soft mt-1 leading-snug">{step.s}</div>
          </li>
        ))}
      </ol>

      <EmeraldInfoPanel className="mb-5">
        <strong className="text-emerald">{heEn(he, "שער ברור:", "Clear gate:")}</strong>{" "}
        {he
          ? "עברת test vectors + Status List מאומת קריפטוגרפית = READY_FOR_PIONEER. בלי זה — אל תטענו תמיכה ואל תתבעו Pioneer."
          : "Pass test vectors + cryptographically verified Status List = READY_FOR_PIONEER. Without that — do not claim support and do not claim Pioneer."}
      </EmeraldInfoPanel>

      <Card className="p-5 mb-5 border-[rgba(240,180,92,0.35)] bg-[rgba(240,180,92,0.07)]">
        <div className="font-extrabold text-[15px] mb-2">
          {heEn(he, "בטיחות — למה זה לא כסף יוצא", "Safety — why this is not outbound money")}
        </div>
        <ul className="m-0 ps-5 flex flex-col gap-1.5 text-body text-ink-soft leading-relaxed">
          <li>
            {heEn(
              he,
              "SDK לאימות בלבד — בלי מפתחות פרטיים, בלי הנפקת Mandate.",
              "Verify-only SDKs — no private keys, cannot issue Mandates.",
            )}
          </li>
          <li>
            {heEn(
              he,
              "Scopes אסורים תמיד: payment:initiate / transfer, credit:borrow, account:open/close, investment:trade.",
              "Always-forbidden scopes: payment:initiate / transfer, credit:borrow, account:open/close, investment:trade.",
            )}
          </li>
          <li>
            {heEn(
              he,
              "כישלון = דחייה (fail closed). לא ממציאים היתר.",
              "Failure = deny (fail closed). Never invent a permit.",
            )}
          </li>
        </ul>
        <p className="text-[12.5px] mt-3 mb-0">
          <a className="text-emerald font-bold" href={GH_SAFETY} target="_blank" rel="noreferrer">
            SAFETY.md
          </a>
          {" · "}
          <a className="text-emerald font-bold" href={GH_QUICKSTART} target="_blank" rel="noreferrer">
            sdk/QUICKSTART.md
          </a>
        </p>
      </Card>

      <Card className="p-5 mb-5 border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.07)]">
        <div className="font-extrabold text-[15px] mb-1">
          {heEn(he, "שלב 1א — Node (~10 דק׳)", "Step 1a — Node (~10 min)")}
        </div>
        <p className="text-body text-ink-soft mt-0 mb-3 leading-relaxed">
          {heEn(
            he,
            "חבילה רשמית @zakai-app/mandate-sdk. עד פרסום npm — מהמונורפו.",
            "Official @zakai-app/mandate-sdk. Until npm publish — from the monorepo.",
          )}
        </p>
        <CodeBlock>{`git clone https://github.com/yyrhlbrstt-svg/Zakai.git
cd Zakai/sdk && npm ci && npm run ready -- --origin ${ORIGIN}
# after publish: npx zakai-mandate-ready --origin ${ORIGIN}`}</CodeBlock>
      </Card>

      <Card className="p-5 mb-5">
        <div className="font-extrabold text-[15px] mb-1">
          {heEn(he, "שלב 1ב — Python (~10 דק׳)", "Step 1b — Python (~10 min)")}
        </div>
        <p className="text-body text-ink-soft mt-0 mb-3 leading-relaxed">
          {heEn(
            he,
            "חבילה רשמית zakai-mandate ב־sdk/python. אותו שער כמו Node. בלי cryptography אין READY.",
            "Official zakai-mandate in sdk/python. Same gate as Node. Without cryptography there is no READY.",
          )}
        </p>
        <CodeBlock>{`cd Zakai/sdk/python
pip install -e '.[crypto]'
zakai-mandate-ready --origin ${ORIGIN}`}</CodeBlock>
      </Card>

      <Card className="p-5 mb-5">
        <div className="font-extrabold text-[15px] mb-1">
          {heEn(he, "שלב 2 — שער המכונה הציבורי", "Step 2 — public machine gate")}
        </div>
        <CodeBlock>{`curl -sS "${ORIGIN}/api/mandate/ready" | jq .ready_for_pioneer
# true`}</CodeBlock>
        <ul className="mt-3 mb-0 ps-5 flex flex-col gap-1 text-[12.5px] font-mono text-ink-soft break-all">
          <li>
            <a className="text-emerald" href={`${ORIGIN}/.well-known/zakai-jwks.json`}>
              /.well-known/zakai-jwks.json
            </a>
          </li>
          <li>
            <a className="text-emerald" href={`${ORIGIN}/api/mandate/test-vectors`}>
              /api/mandate/test-vectors
            </a>
          </li>
          <li>
            <a className="text-emerald" href={`${ORIGIN}/api/mandate/revocations`}>
              /api/mandate/revocations
            </a>
          </li>
          <li>
            <a className="text-emerald" href={`${ORIGIN}/.well-known/zakai-mandate.json`}>
              /.well-known/zakai-mandate.json
            </a>
          </li>
        </ul>
      </Card>

      <Card className="p-5 mb-5">
        <div className="font-extrabold text-[15px] mb-1">
          {heEn(he, "אופציונלי — 3 שורות בקוד שלכם", "Optional — 3 lines in your code")}
        </div>
        <CodeBlock>{`import { verifyMandateFromUrl, FORBIDDEN_SCOPES } from "@zakai-app/mandate-sdk";

const claims = await verifyMandateFromUrl(jws, {
  audience: "your-institution-slug",
  jwksUri: "${ORIGIN}/.well-known/zakai-jwks.json",
});
// FORBIDDEN_SCOPES — never permit outbound money acts`}</CodeBlock>
        <details className="mt-3">
          <summary className="text-[12.5px] text-ink-soft cursor-pointer font-bold select-none">
            Python
          </summary>
          <CodeBlock className="mt-2">{`from zakai_mandate import verify_mandate_from_url, FORBIDDEN_SCOPES

claims = verify_mandate_from_url(
    jws,
    audience="your-institution-slug",
    jwks_uri="${ORIGIN}/.well-known/zakai-jwks.json",
)`}</CodeBlock>
        </details>
        <details className="mt-2">
          <summary className="text-[12.5px] text-ink-soft cursor-pointer font-bold select-none">
            {heEn(he, "חבילת פיילוט (curl)", "Pilot package (curl)")}
          </summary>
          <CodeBlock className="mt-2">{`curl -sS "${ORIGIN}/api/institution/pilot-package?audience=your-institution-id" | jq .`}</CodeBlock>
        </details>
      </Card>

      <Card className="p-5 mb-6 border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.08)]">
        <div className="font-extrabold text-[15px] text-emerald mb-2">
          {heEn(he, "שלב 3 — Pioneer / Reference Verifier", "Step 3 — Pioneer / Reference Verifier")}
        </div>
        <p className="text-[13.5px] text-ink-soft leading-relaxed mb-4">
          {he
            ? "רק אחרי READY_FOR_PIONEER. לחצו «הרץ בדיקות» באשף — הרישום נפתח רק כשהשער ירוק. עד 3 מקומות Pioneer. לא אישור רגולטורי."
            : "Only after READY_FOR_PIONEER. Click “Run checks” in the wizard — listing opens only when the gate is green. Max 3 Pioneer slots. Not regulatory certification."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/institutions/leader" className="no-underline">
            <Button>{heEn(he, "אשף Reference Verifier", "Reference Verifier wizard")}</Button>
          </Link>
          <Link href="/institutions/leaders" className="no-underline">
            <Button variant="ghost">{heEn(he, "קיר Pioneer", "Pioneer wall")}</Button>
          </Link>
        </div>
      </Card>

      <details className="mb-8 text-body text-ink-soft">
        <summary className="cursor-pointer font-bold select-none">
          {heEn(he, "תירוצים שכבר לא עובדים", "Excuses that no longer work")}
        </summary>
        <ul className="mt-3 ps-5 flex flex-col gap-1.5 leading-relaxed">
          <li>{heEn(he, "«צריך שיחת מכירות» — לא. JWKS + vectors + אשף.", "“Need a sales call” — no. JWKS + vectors + wizard.")}</li>
          <li>{heEn(he, "«רק Node / רק Python» — יש את שניהם.", "“Node-only / Python-only” — both official.")}</li>
          <li>{heEn(he, "«זה מזיז כסף» — scopes אסורים + SDK לאימות בלבד.", "“This moves money” — forbidden scopes + verify-only SDK.")}</li>
          <li>{heEn(he, "«איך מקבלים הכרה?» — READY → אשף → Pioneer.", "“How do we get recognized?” — READY → wizard → Pioneer.")}</li>
        </ul>
      </details>

      <p className="text-[12.5px] text-ink-soft leading-relaxed mb-0">
        {he
          ? "תשתית בלי נפח צרכני נשארת יפה ולא הכרחית. אחרי Quickstart — הלולאה ב־/money חייבת לייצר Mandates אמיתיים."
          : "Infrastructure without consumer volume stays pretty, not necessary. After Quickstart — the /money loop must produce real Mandates."}{" "}
        <Link href="/money" className="text-emerald font-extrabold no-underline hover:underline">
          /money
        </Link>
      </p>
    </VerticalPageShell>
  );
}
